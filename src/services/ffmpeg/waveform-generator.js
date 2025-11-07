import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createSubscriptionService, publishMessage } from 'micro-js'
import { mergeAndUpdateTrackMetadata } from '../../lib/metadata-cache.js'
import Logger from 'micro-js/logger'

const logger = new Logger({ logGroup: 'waveform-generator' })

const waveformsDir = path.join(process.cwd(), 'data', 'waveforms')

/**
 * Generate waveform PNG image using FFmpeg
 * @param {string} audioFilePath - Path to audio file
 * @param {string} outputPath - Path for output PNG
 * @param {Object} options - Waveform generation options
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function generateWaveform(audioFilePath, outputPath, options = {}) {
  const {
    width = 1800,        // Width in pixels
    height = 280,        // Height in pixels
    colors = 'b19cd9'    // Waveform color (primary lavender)
  } = options
  
  return new Promise((resolve) => {
    logger.info(`Generating waveform: ${path.basename(audioFilePath)} → ${path.basename(outputPath)}`)
    
    // FFmpeg showwavespic filter generates a static waveform image
    const ffmpeg = spawn('ffmpeg', [
      '-i', audioFilePath,
      '-filter_complex', 
      `showwavespic=s=${width}x${height}:colors=${colors}`,
      '-frames:v', '1',
      '-y',
      outputPath
    ])
    
    let stderr = ''
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString()
    })
    
    ffmpeg.on('close', async (code) => {
      if (code !== 0) {
        logger.error(`Waveform generation failed with code ${code}:`, stderr)
        resolve({ 
          success: false, 
          error: `FFmpeg exited with code ${code}`,
          stderr: stderr.slice(-500)
        })
        return
      }
      
      // Verify output file exists
      try {
        await fs.access(outputPath, fs.constants.F_OK)
      } catch (err) {
        resolve({ 
          success: false, 
          error: 'Waveform file was not created' 
        })
        return
      }
      
      const stat = await fs.stat(outputPath)
      if (stat.size === 0) {
        resolve({ 
          success: false, 
          error: 'Waveform file is empty' 
        })
        return
      }
      
      logger.info(`Waveform generated successfully: ${path.basename(outputPath)} (${stat.size} bytes)`)
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
 * Update track metadata with waveform URL
 * @param {string} waveformFileName - Waveform filename
 */
async function updateMetadataWithWaveform(trackId, waveformFileName) {
  try {
    await mergeAndUpdateTrackMetadata(trackId, {
      updatedAt: new Date().toISOString(),
      waveformFileName: waveformFileName
    })
    
    logger.info(`Updated metadata with waveform URL: ${waveformFileName}`)
  } catch (err) {
    logger.error('Failed to update metadata with waveform:', err)
    throw err
  }
}

/**
 * Process waveform generation request
 * @param {Object} message - Message from pubsub
 */
async function processWaveformGeneration(message) {
  const { messageId, trackId, transcodedFilePath, waveformFilePath } = message
  
  logger.info(`[${messageId}] Generating waveform for track ${trackId}`)
  
  try {
    // Check if transcoded file exists
    await fs.access(transcodedFilePath, fs.constants.F_OK)
    
    // Generate waveform filename (matches transcoded file basename)
    const baseName = path.basename(transcodedFilePath, path.extname(transcodedFilePath))
    const waveformFileName = `${baseName}.png`
    const waveformPath = path.join(waveformsDir, waveformFileName)
    
    // Generate waveform image
    const result = await generateWaveform(transcodedFilePath, waveformPath)
    
    if (!result.success) {
      throw new Error(result.error || 'Waveform generation failed')
    }
    
    await updateMetadataWithWaveform(trackId, waveformFileName)
    
    logger.info(`[${messageId}] Waveform generation complete`)
    
    // Publish completion event (optional - doesn't block track availability)
    await publishMessage('waveformComplete', {
      messageId,
      trackId,
      waveformPath,
      waveformFileName,
      timestamp: new Date().toISOString()
    })

    logger.warn('publishing event for static file service')
    await publishMessage('micro:file-updated', {
      urlPath: `/api/waveforms/${waveformFileName}`,
      filePath: waveformPath,
      size: (await fs.stat(waveformPath)).size,
      mimeType: 'image/png',
      originalName: waveformFileName,
      savedName: waveformFileName,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    logger.error(`[${messageId}] Waveform generation failed:`, error)
    // Don't publish failure event - waveforms are optional enhancement
    // Track should still be available even if waveform fails
  }
}

/**
 * Initialize waveform generator service
 */
export default async function initializeWaveformGenerator() {
  logger.info('Initializing waveform generator service')

  // Ensure waveforms directory exists
  await fs.access(waveformsDir, fs.constants.F_OK)
  await fs.mkdir(waveformsDir, { recursive: true })
  
  // Subscribe to transcode completion events
  let waveformService = await createSubscriptionService('waveform-generator', 'audioTranscodeComplete', async (message) => {
    // Run async without blocking
    try {
      await processWaveformGeneration(message)
    } catch (err) {
      logger.error(`Waveform generation error:`, err)
    }
  })
  
  logger.info(`Waveforms will be saved to: ${waveformsDir}`)

  return waveformService
}
