import fs from 'node:fs/promises'
import path from 'node:path'
import { createSubscriptionService } from 'micro-js'
import { mergeAndUpdateTrackMetadata } from '../lib/metadata-cache.js'
import { verifyFile, fileExists } from '../lib/fs-helpers.js'
import Logger from 'micro-js/logger'

const logger = new Logger({ logGroup: 'audio-cleanup' })

// Timeout in milliseconds (2 minutes should be plenty for most files)
const PROCESSING_TIMEOUT = 2 * 60 * 1000
const CHECK_INTERVAL = 2000 // Check every 2 seconds

// Track processing status for error event short-circuiting
const processingStatus = new Map()

/**
 * Wait for both transcode and metadata to complete
 * @param {Object} message - Processing message
 * @returns {Promise<{success: boolean, errors: string[], details: Object}>}
 */
async function waitForProcessingComplete(message) {
  const { messageId, trackId, transcodedFilePath, waveformFilePath, originalFilePath } = message
  const startTime = Date.now()
  const errors = []
  
  logger.info(`[${messageId}] Waiting for processing to complete (timeout: ${PROCESSING_TIMEOUT}ms)`)
  
  return new Promise((resolve) => {
    const checkInterval = setInterval(async () => {
      const elapsed = Date.now() - startTime
      
      // Check for failure event (short-circuit)
      const status = processingStatus.get(trackId)
      if (status?.failed) {
        clearInterval(checkInterval)
        logger.error(`[${messageId}] Processing failed in service: ${status.service}`)
        resolve({
          success: false,
          errors: [`Processing failed in ${status.service}: ${status.error}`],
          details: {
            trackId,
            failedService: status.service,
            failureReason: status.error,
            elapsedTime: elapsed
          }
        })
        return
      }
      
      // Check if timeout exceeded
      if (elapsed > PROCESSING_TIMEOUT) {
        clearInterval(checkInterval)
        
        const transcodedCheck = await verifyFile(transcodedFilePath, 'Transcoded file')
        const waveformCheck = await verifyFile(waveformFilePath, 'Waveform file')
        const originalCheck = await verifyFile(originalFilePath, 'Original file')
        
        // Build detailed error report
        const timeoutErrors = []
        if (!transcodedCheck.exists || transcodedCheck.error) {
          timeoutErrors.push(transcodedCheck.error || 'Transcoded file missing')
        }
        if (!waveformCheck.exists || waveformCheck.error) {
          timeoutErrors.push(waveformCheck.error || 'Waveform file missing')
        }
        
        logger.error(`[${messageId}] Processing timeout after ${elapsed}ms`)
        logger.error(`[${messageId}] Timeout Details:`, {
          transcoded: {
            path: transcodedFilePath,
            exists: transcodedCheck.exists,
            size: transcodedCheck.size,
            error: transcodedCheck.error
          },
          waveform: {
            path: waveformFilePath,
            exists: waveformCheck.exists,
            size: waveformCheck.size,
            error: waveformCheck.error
          },
          original: {
            path: originalFilePath,
            exists: originalCheck.exists,
            size: originalCheck.size,
            error: originalCheck.error
          },
          elapsedTime: `${elapsed}ms`,
          timeout: `${PROCESSING_TIMEOUT}ms`
        })
        
        resolve({
          success: false,
          errors: timeoutErrors,
          details: {
            trackId,
            reason: 'timeout',
            timeout: PROCESSING_TIMEOUT,
            elapsedTime: elapsed,
            transcodedCheck,
            metadataCheck,
            originalCheck
          }
        })
        return
      }
      
      // Check if both files exist and are valid
      const transcodedCheck = await verifyFile(transcodedFilePath, 'Transcoded file')
      const originalCheck = await verifyFile(originalFilePath, 'Original file')
      const waveformCheck = await verifyFile(waveformFilePath, 'Waveform file')

      if (transcodedCheck.exists && !transcodedCheck.error && 
          originalCheck.exists && !originalCheck.error &&
          waveformCheck.exists && !waveformCheck.error) {
        clearInterval(checkInterval)
        
        logger.info(`[${messageId}] Processing complete after ${elapsed}ms`)
        logger.info(`[${messageId}] Files verified:`, {
          transcoded: { path: transcodedFilePath, size: transcodedCheck.size },
          original: { path: originalFilePath, size: originalCheck.size },
          waveform: { path: waveformFilePath, size: waveformCheck.size }
        })
        
        resolve({
          success: true,
          errors: [],
          details: {
            trackId,
            elapsedTime: elapsed,
            transcodedSize: transcodedCheck.size,
            originalSize: originalCheck.size,
            waveformSize: waveformCheck.size
          }
        })
      }
    }, CHECK_INTERVAL)
  })
}

/**
 * Delete original raw audio file (stubbed for testing)
 * @param {string} originalFilePath - Path to original file
 * @param {string} messageId - Message ID for logging
 */
async function cleanupOriginalFile(originalFilePath, messageId) {
  try {
    if (!await fileExists(originalFilePath)) {
      logger.warn(`[${messageId}] Original file not found for cleanup: ${originalFilePath}`)
      return
    }
    
    logger.info(`[${messageId}] Cleanup: Would delete original file after 30 minutes: ${originalFilePath}`)
    
    // STUBBED FOR TESTING: Uncomment to enable actual deletion after 30 minutes
    /*
    setTimeout(async () => {
      try {
        await fs.unlink(originalFilePath)
        logger.info(`[${messageId}] Deleted original file: ${originalFilePath}`)
      } catch (err) {
        logger.error(`[${messageId}] Failed to delete original file:`, err)
      }
    }, 30 * 60 * 1000) // 30 minutes
    */
    
  } catch (err) {
    logger.error(`[${messageId}] Error in cleanup:`, err)
  }
}

/**
 * Process cleanup and verification
 * @param {Object} message - Message from pubsub
 */
// TODO use helper?
async function processCleanup(message) {
  const { messageId, trackId, originalFilePath, transcodedFilePath, waveformFilePath } = message
  
  logger.info(`[${messageId}] Starting cleanup service for track ${trackId}`)
  
  // Wait for processing to complete
  const result = await waitForProcessingComplete(message)
  
  if (result.success) {
    logger.info(`[${messageId}] ✅ Processing successful, initiating cleanup`)

    await mergeAndUpdateTrackMetadata(trackId, {
      processingStatus: 'completed',
      processingCompletedAt: new Date().toISOString()
    })
    
    // Cleanup original file (stubbed)
    await cleanupOriginalFile(originalFilePath, messageId)
    
  } else {
    logger.error(`[${messageId}] ❌ Processing failed:`, result.errors)
    logger.error(`[${messageId}] Failure details:`, result.details)
    
    // Update metadata as failed
    await mergeAndUpdateTrackMetadata(trackId, {
      processingStatus: 'failed',
      processingCompletedAt: new Date().toISOString(),
      processingErrors: result.errors
    })
    
    // Keep original file for debugging
    logger.info(`[${messageId}] Original file preserved for debugging: ${originalFilePath}`)
  }
  
  // Cleanup tracking map
  processingStatus.delete(trackId)
}

/**
 * Initialize audio cleanup service
 */
export default async function initializeAudioCleanupService() {
  logger.info('Initializing audio cleanup service')
  
  // Subscribe to main processing message
  let cleanupService = await createSubscriptionService('audio-cleanup-service', {
    'processUploadedAudio': async (message) => {
      // Don't await - run async in background
      processCleanup(message).catch(err => {
        logger.error(`[${message.messageId}] Cleanup service error:`, err)
      })
    },
    'audioProcessingFailed': async (message) => {
      const { trackId, service, error } = message
      logger.warn(`[${message.messageId}] Processing failure detected from ${service}`)
      
      processingStatus.set(trackId, {
        failed: true,
        service,
        error
      })
    },
    'waveformComplete': async (message) => {
      const { trackId } = message
      logger.info(`[${message.messageId}] Waveform complete for track ${trackId}`)
      // TODO?
      // processingStatus.set(trackId, {
      //   completed: true,
      //   service: 'audio-cleanup'
      // })
    }
  })

  return cleanupService
}

