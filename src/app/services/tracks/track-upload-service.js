import createFileUploadService, { validators } from 'micro-js/file-upload-service'
import { publishMessage } from 'micro-js'
import path from 'node:path'
import crypto from 'node:crypto'
import { rawAudioDir } from '../../../lib/utils.js'
import { setTrackMetadata } from '../../../lib/metadata-cache.js'
import Logger from 'micro-js/logger'

const logger = new Logger({ logGroup: 'track-upload-service' })

/**
 * Normalize filename: replace spaces with dashes, add crypto token
 * @param {string} originalName - Original filename
 * @param {Object} formData - Form data containing metadata
 * @returns {string} Normalized filename
 */
function normalizeFileName(originalName, formData) {
  // Get file extension
  const ext = path.extname(originalName)
  const baseName = path.basename(originalName, ext)
  
  // Normalize: spaces to dashes, lowercase, remove special chars
  const normalized = baseName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-_]/g, '')
    .replace(/-+/g, '-') // Multiple dashes to single
    .replace(/^-+|-+$/g, '') // Remove leading/trailing dashes
  
  // Add crypto token to prevent duplicates
  const token = crypto.randomBytes(4).toString('hex')
  
  // Use title from form if available, otherwise use normalized name
  const finalName = formData.title 
    ? formData.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-_]/g, '') 
    : normalized
  
  return `${finalName}-${token}${ext}`
}


/**
 * Create and configure the track upload service
 * @returns {Promise<Service>} The configured upload service
 */
export default async function createTrackUploadService({
  serviceName,
  useAuthService,
  publishFileEvents,
  updateChannel,
  urlPathPrefix
}) {

  /**
   * Update track metadata after successful upload
   * @param {Object} uploadData - Upload success data
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async function onUploadSuccess(uploadData, req, res) {
    try {
      const { file, fields } = uploadData
      const { title, description } = fields
      
      if (!title) {
        throw new Error('Title is required')
      }
      
      const ext = path.extname(file.savedName)
      const baseNameWithToken = path.basename(file.savedName, ext)
      const trackId = baseNameWithToken
      
      // Generate all expected URLs
      const rawAudioUrl = `/audio/raw/${file.savedName}`
      const optimizedFileName = `${baseNameWithToken}.webm`
      const waveformFileName = `${baseNameWithToken}.png`
      const optimizedAudioUrl = `/audio/optimized/${optimizedFileName}`
      const waveformUrl = `/images/waveforms/${waveformFileName}`

      // Create initial track metadata with pending status
      const trackData = {
        id: trackId,
        title,
        description: description || '',

        originalFileName: file.savedName,
        fileType: file.mimeType,
        fileSize: file.size,
        
        // All URLs - raw is immediate, optimized and waveform are added during processing
        rawAudioUrl,
        optimizedAudioUrl: null,  // Will be set by internal-uploads when transcoding completes
        waveformUrl: null,        // Will be set by internal-uploads when waveform completes

        processingStatus: 'pending', // pending | processing | completed | failed
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        shareableLink: trackId,  // Same as id for simplicity
        comments: []
      }
      
      // Save initial metadata to cache
      await setTrackMetadata(trackId, trackData)

      const messageId = crypto.randomUUID()
      logger.info(`Track uploaded successfully: ${trackData.title} (${trackId})`)
      logger.info(`Message ID: ${messageId}`)
      logger.info(`Raw audio URL: ${rawAudioUrl}`)
      logger.info(`Expected optimized URL: ${optimizedAudioUrl}`)
      logger.info(`Expected waveform URL: ${waveformUrl}`)
      
      // Send success response immediately
      const response = {
        success: true,
        message: 'Track uploaded successfully, processing in background',
        track: trackData,
        file: {
          originalName: file.originalName,
          savedName: file.savedName,
          size: file.size,
          mimeType: file.mimeType
        },
        processing: {
          messageId,
          status: 'pending'
        }
      }

      logger.info('Upload success track info:', response.track)
      
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(response))
      
      // Publish message to trigger processing pipeline
      await publishMessage('transcodeAudio', {
        messageId,
        trackId,
        rawAudioUrl,           // URL for ffmpeg services to fetch raw audio
        optimizedAudioUrl,     // Expected URL for transcoded output
        waveformUrl,           // Expected URL for waveform output
        optimizedFileName,     // Filename for transcoded file
        waveformFileName,      // Filename for waveform file
        timestamp: new Date().toISOString()
      })

      
    } catch (error) {
      console.error('Error in upload success handler:', error)
      
      // Clean up uploaded file on metadata creation failure
      try {
        if (uploadData.file && uploadData.file.path) {
          await fs.unlink(uploadData.file.path)
          console.log('Cleaned up uploaded file after metadata error')
        }
      } catch (cleanupError) {
        console.error('Failed to cleanup file:', cleanupError)
      }
      
      const errorResponse = {
        success: false,
        error: 'Failed to create track metadata',
        details: error.message
      }
      
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(errorResponse))
    }
  }


  /**
   * Handle upload errors
   * @param {Object} errorData - Error data
   * @param {Error} error - Original error
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  function onUploadError(errorData, error, req, res) {
    console.error('Upload error:', errorData, error)
    
    const response = {
      success: false,
      error: errorData.error || 'Upload failed',
      details: errorData.details || error?.message
    }
    
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(response))
  }

  return await createFileUploadService({
    serviceName,
    useAuthService,
    publishFileEvents,
    updateChannel,
    urlPathPrefix,
    uploadDir: rawAudioDir, // Upload to rawAudio directory first
    fileFieldName: 'audio', // Expect file field to be named 'audio'
    textFields: ['title', 'description'], // Capture these text fields
    getFileName: normalizeFileName,
    validateFile: validators.mimeType(['audio/*', 'video/*']), // Accept any audio type
    onSuccess: onUploadSuccess,
    onError: onUploadError,
    useAuthService
  })
}
