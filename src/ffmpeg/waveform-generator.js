import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { createSubscriptionService, publishMessage } from 'micro-js'
import { mergeAndUpdateTrackMetadata } from '../lib/metadata-cache.js'
import { uploadFile } from '../lib/upload-helper.js'
import Logger from 'micro-js/logger'
import { getTrackFilenames } from '../lib/track-metadata-model.js'

const logger = new Logger({ logGroup: 'waveform-generator' })

/**
 * Generate waveform PNG image using FFmpeg
 * @param {string} audioFileUrl - URL to audio file
 * @param {string} outputFileName - Desired output filename
 * @param {Object} options - Waveform generation options
 * @returns {Promise<{success: boolean, tempFilePath?: string, error?: string}>}
 */
async function generateWaveform(audioFileUrl, outputFileName, options = {}) {
  const {
    width = 1800,        // Width in pixels
    height = 280,        // Height in pixels
    colors = 'b19cd9'    // Waveform color (primary lavender)
  } = options
  
  // Create temp file for output
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'waveform-'))
  const outputPath = path.join(tempDir, outputFileName)
  
  return new Promise((resolve) => {
    audioFileUrl = process.env.MICRO_REGISTRY_URL + audioFileUrl
    logger.info(`Generating waveform: ${audioFileUrl} → ${outputFileName}`)
    
    // FFmpeg showwavespic filter generates a static waveform image
    const ffmpeg = spawn('ffmpeg', [
      '-i', audioFileUrl,
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
        await fs.rm(tempDir, { recursive: true, force: true })
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
        await fs.rm(tempDir, { recursive: true, force: true })
        resolve({ 
          success: false, 
          error: 'Waveform file was not created' 
        })
        return
      }
      
      const stat = await fs.stat(outputPath)
      if (stat.size === 0) {
        await fs.rm(tempDir, { recursive: true, force: true })
        resolve({ 
          success: false, 
          error: 'Waveform file is empty' 
        })
        return
      }
      
      logger.info(`Waveform generated successfully: ${outputFileName} (${stat.size} bytes)`)
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
 * Update track metadata with waveform URL
 * @param {string} waveformFileName - Waveform filename
 */
async function updateMetadataWithWaveform(trackId, waveformFileName) {
  try {
    await mergeAndUpdateTrackMetadata(trackId, {
      isWaveformGenerated: true,
      updatedAt: new Date().toISOString(),
      waveformUrl: `/images/waveforms/${waveformFileName}`
    })
    
    logger.info(`Updated metadata with waveform URL: ${waveformFileName}`)
  } catch (err) {
    logger.error('Failed to update metadata with waveform:', err)
    throw err
  }
}

/**
 * Process waveform generation request
 * @param {Object} message - Message from pubsub (audioTranscodeComplete)
 */
async function processWaveformGeneration(message) {
  const { messageId, trackId, transcodedFileUrl } = message
  
  logger.info(`[${messageId}] Generating waveform for track ${trackId}`)
  
  // Get predictable waveform filename from domain model
  const { waveformFileName } = getTrackFilenames(trackId)
  
  logger.debug(`Input: ${transcodedFileUrl}`)
  logger.debug(`Output: ${waveformFileName}`)
  
  let tempDir = null
  
  try {
    // Generate waveform image
    const result = await generateWaveform(transcodedFileUrl, waveformFileName)
    
    if (!result.success) {
      throw new Error(result.error || 'Waveform generation failed')
    }
    
    tempDir = result.tempDir
    
    // Upload waveform to main service
    logger.info(`[${messageId}] Uploading waveform to main service`)
    await uploadFile('waveform-upload-service', result.tempFilePath, {
      originalName: waveformFileName
    })
    
    // Update metadata with waveform URL (predictable from trackId)
    await updateMetadataWithWaveform(trackId, waveformFileName)
    
    logger.info(`[${messageId}] Waveform generation complete`)
    
    // Publish completion event (optional - doesn't block track availability)
    await publishMessage('waveformComplete', {
      messageId,
      trackId,
      waveformFileName,
      timestamp: new Date().toISOString()
    })
    
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true })
    logger.info(`[${messageId}] Cleaned up temp files`)
    
  } catch (error) {
    logger.error(`[${messageId}] Waveform generation failed:`, error)
    
    // Clean up temp directory on error
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
    
    // Don't publish failure event - waveforms are optional enhancement
    // Track should still be available even if waveform fails
  }
}

/**
 * Initialize waveform generator service
 */
export default async function initializeWaveformGenerator() {
  logger.info('Initializing waveform generator service')
  
  // Subscribe to transcode completion events
  let waveformService = await createSubscriptionService('waveform-generator', 'audioTranscodeComplete', async (message) => {
    // Run async without blocking
    try {
      await processWaveformGeneration(message)
    } catch (err) {
      logger.error(`Waveform generation error:`, err)
    }
  })

  return waveformService
}
