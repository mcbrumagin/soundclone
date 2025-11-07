import fs from 'node:fs'
import path from 'node:path'
import { publishMessage } from 'micro-js'
import { uploadsDir, metadataDir, rawAudioDir, waveformsDir } from '../lib/utils.js'

export default async function deleteTrack(payload, request) {
  try {
    console.log('deleteTrack service called')
    const { trackId } = payload || {}
    
    if (!trackId) {
      const error = new Error('Track ID is required')
      error.status = 400
      throw error
    }
    
    const trackPath = path.join(metadataDir, `${trackId}.json`)
    
    if (!fs.existsSync(trackPath)) {
      const error = new Error('Track not found')
      error.status = 404
      throw error
    }
    
    const trackData = JSON.parse(fs.readFileSync(trackPath, 'utf8'))
    
    // Collect all files to delete
    const filesToDelete = []
    
    // Transcoded audio file (uploads)
    const uploadPath = path.join(uploadsDir, trackData.fileName)
    if (fs.existsSync(uploadPath)) {
      filesToDelete.push(uploadPath)
    }
    
    // Raw audio file
    if (trackData.originalFileName) {
      const rawPath = path.join(rawAudioDir, trackData.originalFileName)
      if (fs.existsSync(rawPath)) {
        filesToDelete.push(rawPath)
      }
    }
    
    // Waveform file
    if (trackData.waveformFileName) {
      const waveformPath = path.join(waveformsDir, trackData.waveformFileName)
      if (fs.existsSync(waveformPath)) {
        filesToDelete.push(waveformPath)
      }
    }
    
    // Delete all files and publish events
    for (const filePath of filesToDelete) {
      fs.unlinkSync(filePath)
      console.log(`Deleted file: ${filePath}`)
      
      // Publish file-deleted event for S3 backup
      await publishMessage('micro:file-deleted', {
        filePath,
        timestamp: new Date().toISOString()
      })
    }
    
    // Delete metadata file last
    fs.unlinkSync(trackPath)
    console.log(`Deleted metadata: ${trackPath}`)
    
    // Publish metadata deletion event
    await publishMessage('micro:file-deleted', {
      filePath: trackPath,
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

