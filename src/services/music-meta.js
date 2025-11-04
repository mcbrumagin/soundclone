import path from 'node:path'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import { spawn } from 'node:child_process'
import { createSubscription, publishMessage } from 'micro-js'
import Logger from 'micro-js/logger'

const logger = new Logger({ logGroup: 'music-meta' })

const metadataDir = path.join(process.cwd(), 'data','metadata')
const rawAudioDir = path.join(process.cwd(), 'data', 'rawAudio')

/**
 * Get comprehensive audio metadata using ffprobe
 * @param {string} filePath - Path to audio file
 * @returns {Promise<Object>} Audio metadata
 */
async function getAudioMetadata(filePath) {
  return new Promise((resolve) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath
    ])
    
    let output = ''
    ffprobe.stdout.on('data', (data) => {
      output += data.toString()
    })
    
    ffprobe.on('close', (code) => {
      if (code !== 0) {
        logger.error('ffprobe failed with code', code)
        resolve(null)
        return
      }
      
      try {
        const info = JSON.parse(output)
        const audioStream = info.streams?.find(s => s.codec_type === 'audio')
        const format = info.format
        
        // Extract metadata from format tags (ID3, etc.)
        const tags = format?.tags || {}
        
        const metadata = {
          // Audio properties
          duration: parseFloat(format?.duration) || 0,
          bitrate: parseInt(format?.bit_rate) || 0,
          sampleRate: parseInt(audioStream?.sample_rate) || 0,
          channels: parseInt(audioStream?.channels) || 0,
          codec: audioStream?.codec_name || 'unknown',
          format: format?.format_name || 'unknown',
          
          // ID3/metadata tags (case-insensitive search)
          artist: tags.artist || tags.ARTIST || tags.Artist || null,
          title: tags.title || tags.TITLE || tags.Title || null,
          album: tags.album || tags.ALBUM || tags.Album || null,
          year: tags.date || tags.DATE || tags.year || tags.YEAR || null,
          genre: tags.genre || tags.GENRE || tags.Genre || null,
          comment: tags.comment || tags.COMMENT || tags.Comment || null
        }
        
        resolve(metadata)
      } catch (err) {
        logger.error('Error parsing ffprobe output:', err)
        resolve(null)
      }
    })
    
    ffprobe.on('error', (err) => {
      logger.error('ffprobe spawn error:', err)
      resolve(null)
    })
  })
}

async function processAudioMetadata(message) {
  const { messageId, trackId, originalFilePath, metadataFilePath } = message
  
  logger.info(`[${messageId}] Processing metadata for track ${trackId}`)
  
  try {
    // Check if input file exists
    if (!fsSync.existsSync(originalFilePath)) {
      throw new Error(`Original file not found: ${originalFilePath}`)
    }
    
    // Read existing metadata file created during upload
    let existingMetadata = {}
    if (fsSync.existsSync(metadataFilePath)) {
      const content = await fs.readFile(metadataFilePath, 'utf-8')
      existingMetadata = JSON.parse(content)
      logger.debug(`[${messageId}] Loaded existing metadata from ${metadataFilePath}`)
    }
    
    // Extract audio metadata using ffprobe
    const extractedMetadata = await getAudioMetadata(originalFilePath)
    
    if (!extractedMetadata) {
      throw new Error('Failed to extract audio metadata with ffprobe')
    }
    
    logger.info(`[${messageId}] Audio metadata extracted:`, {
      duration: extractedMetadata.duration,
      bitrate: extractedMetadata.bitrate,
      sampleRate: extractedMetadata.sampleRate,
      channels: extractedMetadata.channels,
      codec: extractedMetadata.codec,
      hasID3: !!(extractedMetadata.artist || extractedMetadata.title)
    })
    
    // Merge extracted metadata with existing metadata
    const mergedMetadata = {
      ...existingMetadata,
      ...extractedMetadata,
      // Keep original title from upload if no ID3 title
      title: extractedMetadata.title || existingMetadata.title,
      updatedAt: new Date().toISOString()
    }
    
    // Write merged metadata back to file
    await fs.writeFile(metadataFilePath, JSON.stringify(mergedMetadata, null, 2))
    logger.info(`[${messageId}] Metadata written to: ${metadataFilePath}`)
    
    // Publish success event
    await publishMessage('audioMetadataComplete', {
      messageId,
      trackId,
      metadataFilePath,
      metadata: extractedMetadata,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    logger.error(`[${messageId}] Metadata extraction failed:`, error)
    
    // Publish failure event to short-circuit other services
    await publishMessage('audioProcessingFailed', {
      messageId,
      trackId,
      service: 'audio-metadata',
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
}

export default async function initializeMusicMetadataProcessor() {
  logger.info('Initializing audio metadata service')
  
  await createSubscription('processUploadedAudio', async (message) => {
    await processAudioMetadata(message)
  })
}
