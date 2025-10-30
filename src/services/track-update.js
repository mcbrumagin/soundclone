import fs from 'node:fs'
import path from 'node:path'
import { metadataDir } from '../lib/utils.js'

export default async function updateTrack(payload, request) {
  try {
    console.log('updateTrack service called')
    const { trackId, title, description } = payload || {}
    
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
    
    if (title) trackData.title = title
    if (description !== undefined) trackData.description = description
    trackData.updatedAt = new Date().toISOString()
    
    fs.writeFileSync(trackPath, JSON.stringify(trackData, null, 2))
    return { success: true, track: trackData }
  } catch (err) {
    console.error('updateTrack service error:', err)
    if (err.status) throw err
    const error = new Error('Internal server error: ' + err.message)
    error.status = 500
    throw error
  }
}

