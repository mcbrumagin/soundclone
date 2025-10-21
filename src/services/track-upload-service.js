import createFileUploadService, { validators } from 'micro-js/file-upload-service'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { uploadsDir, metadataDir } from '../lib/utils.js'

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
    
    // Create track metadata
    const trackId = crypto.randomUUID()
    const trackData = {
      id: trackId,
      title,
      description: description || '',
      fileName: file.savedName,
      fileType: file.mimeType,
      fileSize: file.size,
      duration: 60, // TODO: Extract from audio file
      audioUrl: `/api/audio/${trackId}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      shareableLink: trackId,
      comments: [],
      uploadPending: false
    }
    
    // Save metadata
    const metadataPath = path.join(metadataDir, `${trackId}.json`)
    fs.writeFileSync(metadataPath, JSON.stringify(trackData, null, 2))
    
    console.log(`Track uploaded successfully: ${trackData.title} (${trackId})`)
    
    // Send success response
    const response = {
      success: true,
      message: 'Track uploaded successfully',
      track: trackData,
      file: {
        originalName: file.originalName,
        savedName: file.savedName,
        size: file.size,
        mimeType: file.mimeType
      }
    }
    
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(response))
    
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

/**
 * Create and configure the track upload service
 * @returns {Promise<Service>} The configured upload service
 */
export default async function createTrackUploadService() {
  return await createFileUploadService({
    uploadDir: uploadsDir,
    fileFieldName: 'audio', // Expect file field to be named 'audio'
    textFields: ['title', 'description'], // Capture these text fields
    getFileName: normalizeFileName,
    validateFile: validators.mimeType(['audio/*']), // Accept any audio type
    onSuccess: onUploadSuccess,
    onError: onUploadError
  })
}
