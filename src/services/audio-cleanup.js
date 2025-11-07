import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import path from 'node:path'
import { createSubscriptionService } from 'micro-js'
import Logger from 'micro-js/logger'

const logger = new Logger({ logGroup: 'audio-cleanup' })

// Timeout in milliseconds (2 minutes should be plenty for most files)
const PROCESSING_TIMEOUT = 2 * 60 * 1000
const CHECK_INTERVAL = 2000 // Check every 2 seconds

// Track processing status for error event short-circuiting
const processingStatus = new Map()

/**
 * Verify that a file exists and is valid
 * @param {string} filePath - Path to file
 * @param {string} description - Description for logging
 * @returns {{exists: boolean, size: number, error?: string}}
 */
function verifyFile(filePath, description) {
  try {
    if (!fs.existsSync(filePath)) {
      return {
        exists: false,
        size: 0,
        error: `${description} does not exist: ${filePath}`
      }
    }
    
    const stat = fs.statSync(filePath)
    
    if (stat.size === 0) {
      return {
        exists: true,
        size: 0,
        error: `${description} is empty (0 bytes): ${filePath}`
      }
    }
    
    return {
      exists: true,
      size: stat.size
    }
  } catch (err) {
    return {
      exists: false,
      size: 0,
      error: `Error checking ${description}: ${err.message}`
    }
  }
}

/**
 * Wait for both transcode and metadata to complete
 * @param {Object} message - Processing message
 * @returns {Promise<{success: boolean, errors: string[], details: Object}>}
 */
async function waitForProcessingComplete(message) {
  const { messageId, trackId, transcodedFilePath, metadataFilePath, originalFilePath } = message
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
        
        const transcodedCheck = verifyFile(transcodedFilePath, 'Transcoded file')
        const metadataCheck = verifyFile(metadataFilePath, 'Metadata file')
        const originalCheck = verifyFile(originalFilePath, 'Original file')
        
        // Build detailed error report
        const timeoutErrors = []
        if (!transcodedCheck.exists || transcodedCheck.error) {
          timeoutErrors.push(transcodedCheck.error || 'Transcoded file missing')
        }
        if (!metadataCheck.exists || metadataCheck.error) {
          timeoutErrors.push(metadataCheck.error || 'Metadata file missing')
        }
        
        logger.error(`[${messageId}] Processing timeout after ${elapsed}ms`)
        logger.error(`[${messageId}] Timeout Details:`, {
          transcoded: {
            path: transcodedFilePath,
            exists: transcodedCheck.exists,
            size: transcodedCheck.size,
            error: transcodedCheck.error
          },
          metadata: {
            path: metadataFilePath,
            exists: metadataCheck.exists,
            size: metadataCheck.size,
            error: metadataCheck.error
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
      const transcodedCheck = verifyFile(transcodedFilePath, 'Transcoded file')
      const metadataCheck = verifyFile(metadataFilePath, 'Metadata file')
      const waveformCheck = verifyFile(waveformFilePath, 'Waveform file')

      if (transcodedCheck.exists && !transcodedCheck.error && 
          metadataCheck.exists && !metadataCheck.error &&
          waveformCheck.exists && !waveformCheck.error) {
        clearInterval(checkInterval)
        
        logger.info(`[${messageId}] Processing complete after ${elapsed}ms`)
        logger.info(`[${messageId}] Files verified:`, {
          transcoded: { path: transcodedFilePath, size: transcodedCheck.size },
          metadata: { path: metadataFilePath, size: metadataCheck.size }
        })
        
        resolve({
          success: true,
          errors: [],
          details: {
            trackId,
            elapsedTime: elapsed,
            transcodedSize: transcodedCheck.size,
            metadataSize: metadataCheck.size
          }
        })
      }
    }, CHECK_INTERVAL)
  })
}

/**
 * Update track metadata with processing results
 * @param {string} metadataFilePath - Path to metadata file
 * @param {boolean} success - Whether processing succeeded
 * @param {Array} errors - Any errors that occurred
 */
async function updateTrackMetadata(metadataFilePath, success, errors = []) {
  try {
    if (!fs.existsSync(metadataFilePath)) {
      logger.warn(`Cannot update metadata, file doesn't exist: ${metadataFilePath}`)
      return
    }
    
    const content = await fsPromises.readFile(metadataFilePath, 'utf-8')
    const metadata = JSON.parse(content)
    
    metadata.processingStatus = success ? 'completed' : 'failed'
    metadata.processingCompletedAt = new Date().toISOString()
    
    if (!success) {
      metadata.processingErrors = errors
    }
    
    await fsPromises.writeFile(metadataFilePath, JSON.stringify(metadata, null, 2))
    logger.info(`Updated metadata with processing status: ${success ? 'completed' : 'failed'}`)
  } catch (err) {
    logger.error('Failed to update track metadata:', err)
  }
}

/**
 * Delete original raw audio file (stubbed for testing)
 * @param {string} originalFilePath - Path to original file
 * @param {string} messageId - Message ID for logging
 */
async function cleanupOriginalFile(originalFilePath, messageId) {
  try {
    if (!fs.existsSync(originalFilePath)) {
      logger.warn(`[${messageId}] Original file already deleted: ${originalFilePath}`)
      return
    }
    
    logger.info(`[${messageId}] Cleanup: Would delete original file after 30 minutes: ${originalFilePath}`)
    
    // STUBBED FOR TESTING: Uncomment to enable actual deletion after 30 minutes
    /*
    setTimeout(async () => {
      try {
        await fsPromises.unlink(originalFilePath)
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
async function processCleanup(message) {
  const { messageId, trackId, originalFilePath, transcodedFilePath, metadataFilePath } = message
  
  logger.info(`[${messageId}] Starting cleanup service for track ${trackId}`)
  
  // Wait for processing to complete
  const result = await waitForProcessingComplete(message)
  
  if (result.success) {
    logger.info(`[${messageId}] ✅ Processing successful, initiating cleanup`)
    
    // Update metadata as completed
    await updateTrackMetadata(metadataFilePath, true)
    
    // Cleanup original file (stubbed)
    await cleanupOriginalFile(originalFilePath, messageId)
    
  } else {
    logger.error(`[${messageId}] ❌ Processing failed:`, result.errors)
    logger.error(`[${messageId}] Failure details:`, result.details)
    
    // Update metadata as failed
    await updateTrackMetadata(metadataFilePath, false, result.errors)
    
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

