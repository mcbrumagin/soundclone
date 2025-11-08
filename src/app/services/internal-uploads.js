import createFileUploadService from 'micro-js/file-upload-service'
import { publishMessage } from 'micro-js'
import { mergeAndUpdateTrackMetadata } from '../../lib/metadata-cache.js'
import path from 'node:path'
import fs from 'node:fs/promises'
import Logger from 'micro-js/logger'
import { optimizedAudioDir, waveformsDir } from '../../lib/utils.js'

const logger = new Logger({ logGroup: 'internal-uploads' })

/**
 * Create upload service for processed audio files (transcoded)
 */
export async function createTranscodedAudioUploadService() {
  await fs.mkdir(optimizedAudioDir, { recursive: true })
  
  return await createFileUploadService({
    serviceName: 'transcoded-audio-upload-service',
    uploadDir: optimizedAudioDir,
    urlPathPrefix: '/audio/optimized',
    publishFileEvents: true,
    updateChannel: 'micro:file-updated',
    fileFieldName: 'file',
    textFields: ['originalName', 'trackId'],
    getFileName: (originalName, formData) => {
      // Use the provided originalName from the ffmpeg service
      return formData.originalName || originalName
    },
    onSuccess: async (uploadData, req, res) => {
      try {
        const { file, fields } = uploadData
        const trackId = fields.trackId
        
        logger.info(`Transcoded audio uploaded: ${file.savedName} for track ${trackId}`)
        
        // Update track metadata with optimized audio URL
        if (trackId) {
          await mergeAndUpdateTrackMetadata(trackId, {
            optimizedAudioUrl: `/audio/optimized/${file.savedName}`,
            updatedAt: new Date().toISOString()
          })
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          success: true,
          file: {
            savedName: file.savedName,
            size: file.size,
            url: `/audio/optimized/${file.savedName}`
          }
        }))
      } catch (error) {
        logger.error('Error in transcoded audio upload:', error)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          success: false,
          error: error.message
        }))
      }
    },
    onError: (errorData, error, req, res) => {
      logger.error('Transcoded audio upload error:', errorData, error)
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        success: false,
        error: errorData.error || 'Upload failed'
      }))
    }
  })
}

/**
 * Create upload service for waveform images
 */
export async function createWaveformUploadService() {
  await fs.mkdir(waveformsDir, { recursive: true })
  
  return await createFileUploadService({
    serviceName: 'waveform-upload-service',
    uploadDir: waveformsDir,
    urlPathPrefix: '/images/waveforms',
    publishFileEvents: true,
    updateChannel: 'micro:file-updated',
    fileFieldName: 'file',
    textFields: ['originalName', 'trackId'],
    getFileName: (originalName, formData) => {
      // Use the provided originalName from the ffmpeg service
      return formData.originalName || originalName
    },
    onSuccess: async (uploadData, req, res) => {
      try {
        const { file, fields } = uploadData
        const trackId = fields.trackId
        
        logger.info(`Waveform uploaded: ${file.savedName} for track ${trackId}`)
        
        // Update track metadata with waveform URL
        if (trackId) {
          await mergeAndUpdateTrackMetadata(trackId, {
            waveformUrl: `/images/waveforms/${file.savedName}`,
            updatedAt: new Date().toISOString()
          })
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          success: true,
          file: {
            savedName: file.savedName,
            size: file.size,
            url: `/images/waveforms/${file.savedName}`
          }
        }))
      } catch (error) {
        logger.error('Error in waveform upload:', error)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          success: false,
          error: error.message
        }))
      }
    },
    onError: (errorData, error, req, res) => {
      logger.error('Waveform upload error:', errorData, error)
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        success: false,
        error: errorData.error || 'Upload failed'
      }))
    }
  })
}

