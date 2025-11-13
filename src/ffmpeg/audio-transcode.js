import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { createSubscriptionService, publishMessage } from 'micro-js'
import { uploadFile } from '../lib/upload-helper.js'
import Logger from 'micro-js/logger'
import { mergeAndUpdateTrackMetadata } from '../lib/metadata-cache.js'
import { retry } from '../lib/async-helpers.js'
import { getTrackFilenames } from '../lib/track-metadata-model.js'

const logger = new Logger({ logGroup: 'audio-transcode' })

/**
 * Check if audio file is already high-quality Opus
 * @param {string} fileUrl - URL to audio file
 * @returns {Promise<boolean>} True if already Opus with good quality
 */
async function isHighQualityOpus(fileUrl) {
  logger.warn('isHighQualityOpus called with fileUrl:', fileUrl)
  return new Promise((resolve) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_streams',
      '-show_format',
      fileUrl
    ])
    
    let output = ''
    ffprobe.stdout.on('data', (data) => {
      output += data.toString()
    })
    
    ffprobe.on('close', (code) => {
      if (code !== 0) {
        resolve(false)
        return
      }
      
      try {
        const info = JSON.parse(output)
        const audioStream = info.streams.find(s => s.codec_type === 'audio')
        
        const isOpus = audioStream?.codec_name === 'opus'
        const format = info.format?.format_name || ''
        const bitRate = parseInt(audioStream?.bit_rate) || 0
        
        logger.debug(`File ${fileUrl} check:`, {
          codec: audioStream?.codec_name,
          format,
          bitRate: bitRate,
          isOpus
        })
        
        // Consider it good quality if it's Opus at >= 128kbps
        resolve(isOpus && format.includes('webm') && bitRate >= 128000)
      } catch (err) {
        logger.error('Error parsing ffprobe output:', err)
        resolve(false)
      }
    })
    
    ffprobe.on('error', (err) => {
      logger.error('ffprobe error:', err)
      resolve(false)
    })
  })
}

/**
 * Transcode audio file to high-quality Opus in WebM container
 * @param {string} inputUrl - Input file URL
 * @param {string} outputFileName - Desired output filename
 * @returns {Promise<{success: boolean, tempFilePath?: string, error?: string}>}
 */
async function transcodeToOpus(inputUrl, outputFileName) {
  logger.warn('transcodeToOpus called with inputUrl:', inputUrl, 'outputFileName:', outputFileName)
  // Create temp file for output
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'transcode-'))
  const outputPath = path.join(tempDir, outputFileName)
  
  return new Promise((resolve) => {
    inputUrl = process.env.MICRO_REGISTRY_URL + inputUrl
    logger.info(`Starting transcode: ${inputUrl} → ${outputFileName}`)
    
    // Opus encoding with VBR at ~160kbps (transparent quality)
    // Opus is more efficient than MP3: 160kbps Opus ≈ 256kbps MP3
    const ffmpeg = spawn('ffmpeg', [
      '-i', inputUrl,
      '-c:a', 'libopus',        // Opus codec
      '-b:a', '160k',           // 160kbps bitrate (high quality, smaller than MP3)
      '-vbr', 'on',             // Variable bitrate
      '-compression_level', '10', // Maximum compression efficiency
      '-application', 'audio',  // Optimize for music/audio (not voip)
      '-y',                     // Overwrite output file
      outputPath
    ])
    
    let stderr = ''
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString()
    })
    
    ffmpeg.on('close', async (code) => {
      if (code !== 0) {
        logger.error(`Transcode failed with code ${code}:`, stderr)
        // Clean up temp directory
        await fs.rm(tempDir, { recursive: true, force: true })
        resolve({ 
          success: false, 
          error: `FFmpeg exited with code ${code}`,
          stderr: stderr.slice(-500) // Last 500 chars
        })
        return
      }
      
      // Verify output file exists and has content
      try  {
        await fs.access(outputPath, fs.constants.F_OK)
      } catch (err) {
        await fs.rm(tempDir, { recursive: true, force: true })
        resolve({ 
          success: false, 
          error: 'Output file was not created' 
        })
        return
      }
      
      const stat = await fs.stat(outputPath)
      if (stat.size === 0) {
        await fs.rm(tempDir, { recursive: true, force: true })
        resolve({ 
          success: false, 
          error: 'Output file is empty' 
        })
        return
      }
      
      logger.info(`Transcode successful: ${outputFileName} (${stat.size} bytes)`)
      resolve({ success: true, tempFilePath: outputPath, tempDir })
    })
    
    ffmpeg.on('error', async (err) => {
      logger.error('FFmpeg spawn error:', err)
      await fs.rm(tempDir, { recursive: true, force: true })
      resolve({ 
        success: false, 
        error: `Failed to spawn ffmpeg: ${err.message}` 
      })
    })
  })
}

/**
 * Process audio transcode request
 * @param {Object} message - Processing message from domain model
 */
async function processAudioTranscode(message) {
  // Extract properties from processing message (created by createProcessingMessage)
  const { 
    messageId, 
    trackId, 
    rawAudioUrl,
    optimizedAudioUrl,
    optimizedFileName
  } = message
  
  logger.info(`[${messageId}] Processing transcode for track ${trackId}`)
  logger.debug(`Input: ${rawAudioUrl}`)
  logger.debug(`Output: ${optimizedFileName}`)
  
  // Verify we have the expected filename from domain model
  const { optimizedFileName: expectedFileName } = getTrackFilenames(trackId)
  if (optimizedFileName !== expectedFileName) {
    logger.warn(`Filename mismatch: expected ${expectedFileName}, got ${optimizedFileName}`)
  }
  
  let tempDir = null
  
  try {
    let result
    await retry(async () => {
      // Check if already high-quality Opus
      const alreadyOpus = await isHighQualityOpus(rawAudioUrl)
      
      if (alreadyOpus) {
        logger.info(`[${messageId}] File already high-quality Opus, transcoding anyway`)
        result = await transcodeToOpus(rawAudioUrl, optimizedFileName)
      } else {
        logger.info(`[${messageId}] Transcoding to Opus (WebM container)`)
        result = await transcodeToOpus(rawAudioUrl, optimizedFileName)
      }
      
      if (!result.success) {
        throw new Error(result.error || 'Transcode failed')
      }
    }, {
      maxAttempts: 5,
      initialDelay: 100,
      backoffMultiplier: 3,
      shouldRetry: (err) => err.message.includes('404')
    })
    
    tempDir = result.tempDir
    
    // Upload transcoded file to main service
    logger.info(`[${messageId}] Uploading transcoded file to main service`)
    await uploadFile('transcoded-audio-upload-service', result.tempFilePath, {
      originalName: optimizedFileName
    })

    // Update metadata with optimized audio URL (from domain model)
    await mergeAndUpdateTrackMetadata(trackId, {
      isTranscoded: true,
      optimizedAudioUrl,
      updatedAt: new Date().toISOString()
    })
    
    logger.info(`[${messageId}] Transcode complete, publishing success event`)
    await publishMessage('audioTranscodeComplete', {
      messageId,
      trackId,
      transcodedFileUrl: optimizedAudioUrl, // URL for waveform generator to fetch
      timestamp: new Date().toISOString()
    })
    
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true })
    logger.info(`[${messageId}] Cleaned up temp files`)
    
  } catch (error) {
    logger.error(`[${messageId}] Transcode failed:`, error)
    
    // Clean up temp directory on error
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
    
    // Publish failure event to short-circuit other services
    await publishMessage('audioProcessingFailed', {
      messageId,
      trackId,
      service: 'audio-transcode',
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
}

/**
 * Initialize audio transcode service
 */
export default async function initializeAudioTranscodeService() {
  logger.info('Initializing audio transcode service')
  
  let transcodeService = await createSubscriptionService('audio-transcoder', 'transcodeAudio', async (message) => {
    logger.warn('audio-transcoder called with message:', message)
    await processAudioTranscode(message)
  })

  return transcodeService
}

