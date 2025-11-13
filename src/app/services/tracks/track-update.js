import { mergeAndUpdateTrackMetadata } from '../../../lib/metadata-cache.js'

export default async function updateTrack(payload, request) {
  try {
    console.log('updateTrack service called')
    const { trackId, title, description, tags } = payload || {}
    
    if (!trackId) {
      const error = new Error('Track ID is required')
      error.status = 400
      throw error
    }
    
    // Build updates object
    const updates = {}
    if (title) updates.title = title
    if (description !== undefined) updates.description = description
    if (tags !== undefined) updates.tags = tags
    
    // Merge updates into cache (atomic operation)
    const trackData = await mergeAndUpdateTrackMetadata(trackId, updates)
    
    if (!trackData) {
      const error = new Error('Track not found')
      error.status = 404
      throw error
    }
    
    return { success: true, track: trackData }
  } catch (err) {
    console.error('updateTrack service error:', err)
    if (err.status) throw err
    const error = new Error('Internal server error: ' + err.message)
    error.status = 500
    throw error
  }
}

