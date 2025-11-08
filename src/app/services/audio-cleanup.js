import { createSubscriptionService, callService } from 'micro-js'
import { mergeAndUpdateTrackMetadata, getTrackMetadata } from '../../lib/metadata-cache.js'
import Logger from 'micro-js/logger'

const logger = new Logger({ logGroup: 'audio-cleanup' })

// Timeout in milliseconds (2 minutes should be plenty for most files)
const PROCESSING_TIMEOUT = 2 * 60 * 1000
const CHECK_INTERVAL = 2000 // Check every 2 seconds

// Track processing status for error event short-circuiting
const processingStatus = new Map()

/**
 * Check if a URL is accessible by making a HEAD request
 * @param {string} url - URL to check
 * @returns {Promise<boolean>} True if URL is accessible
 */
// TODO implement this or remove
async function checkUrlAccessible(url) {
  try {
    const response = await fetch(url, { method: 'HEAD' })
    return response.ok
  } catch (err) {
    return false
  }
}

/**
 * Wait for both transcode and waveform to complete by checking metadata
 * @param {Object} message - Processing message
 * @returns {Promise<{success: boolean, errors: string[], details: Object}>}
 */
async function waitForProcessingComplete(message) {
  const { messageId, trackId } = message
  const startTime = Date.now()
  
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
        
        const metadata = await getTrackMetadata(trackId)
        const hasOptimized = !!metadata?.optimizedAudioUrl
        const hasWaveform = !!metadata?.waveformUrl
        
        const timeoutErrors = []
        if (!hasOptimized) {
          timeoutErrors.push('Optimized audio URL not set in metadata')
        }
        if (!hasWaveform) {
          timeoutErrors.push('Waveform URL not set in metadata')
        }
        
        logger.error(`[${messageId}] Processing timeout after ${elapsed}ms`)
        logger.error(`[${messageId}] Timeout Details:`, {
          trackId,
          optimizedAudioUrl: metadata?.optimizedAudioUrl || 'not set',
          waveformUrl: metadata?.waveformUrl || 'not set',
          duration: metadata?.duration || 'not set',
          fileMetadata: metadata?.fileMetadata || 'not set',
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
            hasOptimized,
            hasWaveform,
            duration: metadata?.duration || 0,
            fileMetadata: metadata?.fileMetadata || {}
          }
        })
        return
      }
      
      // Check metadata for completed URLs
      const metadata = await getTrackMetadata(trackId)
      const hasOptimized = !!metadata?.optimizedAudioUrl
      const hasWaveform = !!metadata?.waveformUrl

      if (hasOptimized && hasWaveform) {
        clearInterval(checkInterval)
        
        logger.info(`[${messageId}] Processing complete after ${elapsed}ms`)
        logger.info(`[${messageId}] URLs verified in metadata:`, {
          optimizedAudioUrl: metadata.optimizedAudioUrl,
          waveformUrl: metadata.waveformUrl,
          duration: metadata.duration || 0,
          fileMetadata: metadata.fileMetadata || {}
        })
        
        resolve({
          success: true,
          errors: [],
          details: {
            trackId,
            elapsedTime: elapsed,
            optimizedAudioUrl: metadata.optimizedAudioUrl,
            waveformUrl: metadata.waveformUrl,
            duration: metadata.duration || 0,
            fileMetadata: metadata.fileMetadata || {}
          }
        })
      }
    }, CHECK_INTERVAL)
  })
}

/**
 * Delete original raw audio file (stubbed for testing)
 * @param {string} rawAudioUrl - URL to raw audio file
 * @param {string} messageId - Message ID for logging
 */
async function cleanupOriginalFile(rawAudioUrl, messageId) {
  try {
    logger.info(`[${messageId}] Cleanup: Would delete raw audio after 30 minutes: ${rawAudioUrl}`)
    
    // STUBBED FOR TESTING: Uncomment to enable actual deletion after 30 minutes
    /*
    setTimeout(async () => {
      try {
        // TODO: Implement deletion via API or direct file system access
        logger.info(`[${messageId}] Deleted raw audio: ${rawAudioUrl}`)
      } catch (err) {
        logger.error(`[${messageId}] Failed to delete raw audio:`, err)
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
  const { messageId, trackId, rawAudioUrl } = message
  
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
    await cleanupOriginalFile(rawAudioUrl, messageId)
    
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
    logger.info(`[${messageId}] Raw audio preserved for debugging: ${rawAudioUrl}`)
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
    'transcodeAudio': async (message) => {
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
    }
  })

  return cleanupService
}

