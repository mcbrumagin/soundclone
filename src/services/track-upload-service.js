import createFileUploadService, { validators } from 'micro-js/file-upload-service'
import { publishMessage } from 'micro-js'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { rawAudioDir, uploadsDir, metadataDir } from '../lib/utils.js'
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
export default async function createTrackUploadService({ useAuthService }) {

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
      
      // Generate unique IDs
      const messageId = crypto.randomUUID()
      
      // Pre-generate expected filenames using part of original name for debugging
      const ext = path.extname(file.savedName)
      const baseNameWithToken = path.basename(file.savedName, ext)
      
      // Create consistent base name for all related files (transcoded, metadata)
      // Use baseNameWithToken as the trackId for simplicity (matches filenames)
      const trackId = baseNameWithToken
      const transcodedFileName = `${baseNameWithToken}.webm`  // Opus in WebM container
      const metadataFileName = `${baseNameWithToken}.json`
      
      // Build full paths
      const originalFilePath = path.join(rawAudioDir, file.savedName)
      const transcodedFilePath = path.join(uploadsDir, transcodedFileName)
      const metadataFilePath = path.join(metadataDir, metadataFileName)
      
      // Create initial track metadata with pending status
      const trackData = {
        id: trackId,  // Uses filename base for simplicity
        title,
        description: description || '',
        originalFileName: file.savedName,
        transcodedFileName: transcodedFileName,
        fileType: file.mimeType,
        fileSize: file.size,
        audioUrl: `/api/audio/${transcodedFileName}`,
        processingStatus: 'pending', // pending | processing | completed | failed
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        shareableLink: trackId,  // Same as id for simplicity
        comments: []
      }
      
      // Save initial metadata
      fs.writeFileSync(metadataFilePath, JSON.stringify(trackData, null, 2))
      
      console.log(`Track uploaded successfully: ${trackData.title} (${trackId})`)
      console.log(`Message ID: ${messageId}`)
      console.log(`Original: ${originalFilePath}`)
      console.log(`Transcoded: ${transcodedFilePath}`)
      console.log(`Metadata: ${metadataFilePath}`)
      
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
      // All three services (transcode, metadata, cleanup) will subscribe to this
      await publishMessage('processUploadedAudio', {
        messageId,
        trackId,
        originalFilePath,
        transcodedFilePath,
        metadataFilePath,
        timestamp: new Date().toISOString()
      })
      
    } catch (error) {
      console.error('Error in upload success handler:', error)
      
      // Clean up uploaded file on metadata creation failure
      try {
        if (uploadData.file && uploadData.file.path) {
          fs.unlinkSync(uploadData.file.path)
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
