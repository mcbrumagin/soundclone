import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createSubscriptionService, publishMessage } from 'micro-js'
import Logger from 'micro-js/logger'

const logger = new Logger({ logGroup: 'audio-transcode' })

/**
 * Check if audio file is already high-quality Opus
 * @param {string} filePath - Path to audio file
 * @returns {Promise<boolean>} True if already Opus with good quality
 */
async function isHighQualityOpus(filePath) {
  return new Promise((resolve) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_streams',
      '-show_format',
      filePath
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
        
        logger.debug(`File ${path.basename(filePath)} check:`, {
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
 * @param {string} inputPath - Input file path
 * @param {string} outputPath - Output file path
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function transcodeToOpus(inputPath, outputPath) {
  return new Promise((resolve) => {
    logger.info(`Starting transcode: ${path.basename(inputPath)} → ${path.basename(outputPath)}`)
    
    // Opus encoding with VBR at ~160kbps (transparent quality)
    // Opus is more efficient than MP3: 160kbps Opus ≈ 256kbps MP3
    const ffmpeg = spawn('ffmpeg', [
      '-i', inputPath,
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
        resolve({ 
          success: false, 
          error: 'Output file was not created' 
        })
        return
      }
      
      const stat = await fs.stat(outputPath)
      if (stat.size === 0) {
        resolve({ 
          success: false, 
          error: 'Output file is empty' 
        })
        return
      }
      
      logger.info(`Transcode successful: ${path.basename(outputPath)} (${stat.size} bytes)`)
      resolve({ success: true })
    })
    
    ffmpeg.on('error', (err) => {
      logger.error('FFmpeg spawn error:', err)
      resolve({ 
        success: false, 
        error: `Failed to spawn ffmpeg: ${err.message}` 
      })
    })
  })
}

/**
 * Process audio transcode request
 * @param {Object} message - Message from pubsub
 */
async function processAudioTranscode(message) {
  const { messageId, trackId, originalFilePath, transcodedFilePath, waveformFilePath } = message
  
  logger.info(`[${messageId}] Processing transcode for track ${trackId}`)
  
  try {
    // Check if input file exists
    await fs.access(originalFilePath, fs.constants.F_OK)
    
    // Check if already high-quality Opus
    const alreadyOpus = await isHighQualityOpus(originalFilePath)
    
    let result
    if (alreadyOpus) {
      logger.info(`[${messageId}] File already high-quality Opus, copying to final location`)
      await fs.cp(originalFilePath, transcodedFilePath)
      result = { success: true }
    } else {
      logger.info(`[${messageId}] Transcoding to Opus (WebM container)`)
      result = await transcodeToOpus(originalFilePath, transcodedFilePath)
    }
    
    if (result.success) {
      logger.info(`[${messageId}] Transcode complete, publishing success event`)
      await publishMessage('audioTranscodeComplete', {
        messageId,
        trackId,
        transcodedFilePath,
        waveformFilePath, // Pass through for waveform generator
        timestamp: new Date().toISOString()
      })

      logger.warn('publishing event for static file service')
      await publishMessage('micro:file-updated', {
        urlPath: `/api/audio/${path.basename(transcodedFilePath)}`,
        filePath: transcodedFilePath,
        size: (await fs.stat(transcodedFilePath)).size,
        mimeType: 'audio/webm',
        originalName: path.basename(transcodedFilePath),
        savedName: path.basename(transcodedFilePath),
      })
    } else {
      throw new Error(result.error || 'Transcode failed')
    }
    
  } catch (error) {
    logger.error(`[${messageId}] Transcode failed:`, error)
    
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
  
  let transcodeService = await createSubscriptionService('audio-transcoder', 'processUploadedAudio', async (message) => {
    await processAudioTranscode(message)
  })

  return transcodeService
}

