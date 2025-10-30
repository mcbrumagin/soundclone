import fs from 'node:fs'
import path from 'node:path'
import { uploadsDir, metadataDir } from '../lib/utils.js'

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
    const filePath = path.join(uploadsDir, trackData.fileName)
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
    
    fs.unlinkSync(trackPath)
    return { success: true, message: 'Track deleted successfully' }
  } catch (err) {
    console.error('deleteTrack service error:', err)
    if (err.status) throw err
    const error = new Error('Internal server error: ' + err.message)
    error.status = 500
    throw error
  }
}

