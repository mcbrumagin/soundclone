/**
 * Track Metadata Domain Model
 * 
 * This is the canonical structure for track metadata throughout the system.
 * All services should use this model for consistency.
 */

/**
 * Create a new track metadata object
 * @param {Object} params - Track parameters
 * @returns {Object} Track metadata object
 */
export function createTrackMetadata({
  id,
  title,
  description = '',
  tags = [],
  originalFileName,
  fileType,
  fileSize,
  rawAudioUrl,
  optimizedAudioUrl = null,
  waveformUrl = null,
  duration = null,
  realDuration = null,
  processingStatus = 'pending',
  createdAt = new Date().toISOString(),
  updatedAt = new Date().toISOString(),
  comments = []
}) {
  return {
    // Basic info
    id,
    title,
    description,
    tags,
    
    // File info
    originalFileName,
    fileType,
    fileSize,
    
    // URLs
    rawAudioUrl,
    optimizedAudioUrl,
    waveformUrl,
    shareableLink: id, // Same as id for simplicity
    
    // Audio metadata
    duration,
    realDuration,
    
    // Processing
    processingStatus, // 'pending' | 'processing' | 'completed' | 'failed'
    
    // Timestamps
    createdAt,
    updatedAt,
    
    // Social
    comments
  }
}

/**
 * Derive predictable filenames from track ID
 * @param {string} trackId - Track identifier
 * @returns {Object} Filenames object
 */
export function getTrackFilenames(trackId) {
  return {
    optimizedFileName: `${trackId}.webm`,
    waveformFileName: `${trackId}.png`
  }
}

/**
 * Create a processing message for FFmpeg service
 * @param {Object} trackMetadata - Track metadata
 * @returns {Object} Processing message
 */
export function createProcessingMessage(trackMetadata) {
  const { optimizedFileName, waveformFileName } = getTrackFilenames(trackMetadata.id)
  
  return {
    trackId: trackMetadata.id,
    title: trackMetadata.title,
    originalFileName: trackMetadata.originalFileName,
    rawAudioUrl: trackMetadata.rawAudioUrl,
    optimizedAudioUrl: `/audio/optimized/${optimizedFileName}`,
    waveformUrl: `/images/waveforms/${waveformFileName}`,
    optimizedFileName,
    waveformFileName,
    timestamp: new Date().toISOString()
  }
}

/**
 * Update track metadata with processing results
 * @param {Object} trackMetadata - Existing track metadata
 * @param {Object} processingResult - Results from FFmpeg processing
 * @returns {Object} Updated metadata
 */
export function updateTrackWithProcessingResults(trackMetadata, processingResult) {
  return {
    ...trackMetadata,
    optimizedAudioUrl: processingResult.optimizedAudioUrl || trackMetadata.optimizedAudioUrl,
    waveformUrl: processingResult.waveformUrl || trackMetadata.waveformUrl,
    duration: processingResult.duration || trackMetadata.duration,
    realDuration: processingResult.realDuration || trackMetadata.realDuration,
    processingStatus: processingResult.status || trackMetadata.processingStatus,
    updatedAt: new Date().toISOString()
  }
}

/**
 * Validate track metadata
 * @param {Object} metadata - Track metadata to validate
 * @returns {Object} Validation result
 */
export function validateTrackMetadata(metadata) {
  const errors = []
  
  if (!metadata.id) errors.push('id is required')
  if (!metadata.title) errors.push('title is required')
  if (!metadata.originalFileName) errors.push('originalFileName is required')
  if (!metadata.fileType) errors.push('fileType is required')
  
  return {
    valid: errors.length === 0,
    errors
  }
}

