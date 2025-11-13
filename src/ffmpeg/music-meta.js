import path from 'node:path'
import { spawn } from 'node:child_process'
import { createSubscriptionService, publishMessage } from 'micro-js'
import { mergeAndUpdateTrackMetadata } from '../lib/metadata-cache.js'
import Logger from 'micro-js/logger'

const logger = new Logger({ logGroup: 'music-meta' })

/**
 * Get comprehensive audio metadata using ffprobe
 * @param {string} fileUrl - URL to audio file
 * @returns {Promise<Object>} Audio metadata
 */
async function probeAudioMetadata(fileUrl) {
  fileUrl = process.env.MICRO_REGISTRY_URL + fileUrl
  logger.warn('probeAudioMetadata called with fileUrl:', fileUrl)
  return new Promise((resolve) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      fileUrl
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
  const { messageId, trackId, transcodedFileUrl, timestamp } = message
  
  logger.info(`[${messageId}] Processing metadata for track ${trackId}`)
  
  try {
    // Extract audio metadata from original file using ffprobe
    const fileMetadata = await probeAudioMetadata(transcodedFileUrl)
    
    if (!fileMetadata) {
      throw new Error('Failed to extract audio metadata with ffprobe')
    }
    
    logger.info(`[${messageId}] Audio metadata extracted:`, { fileMetadata })
    
    // Merge extracted metadata into cache
    await mergeAndUpdateTrackMetadata(trackId, {
      isFileAnalyzed: true,
      fileMetadata,
      duration: fileMetadata.duration || 0
    })

    logger.info(`[${messageId}] Metadata written to cache`)
    
    // Publish success event
    await publishMessage('audioMetadataComplete', {
      messageId,
      trackId,
      metadata: fileMetadata,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    logger.error(`[${messageId}] Metadata extraction failed:`, error)
    
    // Publish failure event to short-circuit other services
    await publishMessage('audioProcessingFailed', {
      messageId,
      trackId,
      service: 'music-meta',
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
}

export default async function initializeFileAnalysisProcessor() {
  logger.info('Initializing file analysis service')
  
  let fileAnalysisService = await createSubscriptionService('file-analysis-processor', 'audioTranscodeComplete', async (message) => {
    logger.info('file-analysis-processor called with message:', message)
    await processAudioMetadata(message)
  })

  return fileAnalysisService
}
