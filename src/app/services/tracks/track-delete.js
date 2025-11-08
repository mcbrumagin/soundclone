import path from 'node:path'
import { publishMessage } from 'micro-js'
import { uploadsDir, rawAudioDir, waveformsDir } from '../../../lib/utils.js'
import { getTrackMetadata, deleteTrackMetadata } from '../../../lib/metadata-cache.js'
import { fileExists, deleteFiles } from '../../../lib/fs-helpers.js'

export default async function deleteTrack(payload, request) {
  try {
    console.log('deleteTrack service called')
    const { trackId } = payload || {}
    
    if (!trackId) {
      const error = new Error('Track ID is required')
      error.status = 400
      throw error
    }
    
    const trackData = await getTrackMetadata(trackId)
    
    if (!trackData) {
      const error = new Error('Track not found')
      error.status = 404
      throw error
    }
    
    // Collect all files to delete
    const filesToDelete = []
    
    // Transcoded audio file (uploads)
    const uploadPath = path.join(uploadsDir, trackData.transcodedFileName)
    if (await fileExists(uploadPath)) {
      filesToDelete.push(uploadPath)
    }
    
    // Raw audio file
    if (trackData.originalFileName) {
      const rawPath = path.join(rawAudioDir, trackData.originalFileName)
      if (await fileExists(rawPath)) {
        filesToDelete.push(rawPath)
      }
    }
    
    // Waveform file
    if (trackData.waveformFileName) {
      const waveformPath = path.join(waveformsDir, trackData.waveformFileName)
      if (await fileExists(waveformPath)) {
        filesToDelete.push(waveformPath)
      }
    }
    
    // Delete all files and publish events
    const deleteResult = await deleteFiles(filesToDelete, async (filePath) => {
      console.log(`Deleted file: ${filePath}`)
      
      // Publish file-deleted event for S3 backup
      await publishMessage('micro:file-deleted', {
        filePath,
        timestamp: new Date().toISOString()
      })
    })
    
    // Delete metadata from cache
    await deleteTrackMetadata(trackId)
    console.log(`Deleted metadata for track ${trackId} from cache`)
    
    // Publish metadata deletion event for S3 cleanup
    await publishMessage('track-metadata-deleted', {
      trackId,
      timestamp: new Date().toISOString()
    })
    
    return { success: true, message: 'Track deleted successfully' }
  } catch (err) {
    console.error('deleteTrack service error:', err)
    if (err.status) throw err
    const error = new Error('Internal server error: ' + err.message)
    error.status = 500
    throw error
  }
}

