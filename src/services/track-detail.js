import { getTrackMetadata } from '../lib/metadata-cache.js'

export default async function getTrackDetail(payload, request) {
  try {
    console.log('getTrackDetail service called')
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
    
    return { success: true, track: trackData }
  } catch (err) {
    console.error('getTrackDetail service error:', err)
    if (err.status) throw err
    const error = new Error('Internal server error: ' + err.message)
    error.status = 500
    throw error
  }
}

