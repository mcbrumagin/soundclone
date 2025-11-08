import { getAllTrackMetadata } from '../../../lib/metadata-cache.js'

export default async function getTrackList(payload, request, response) {
  try {
    console.log('getTrackList service called')
    let remoteIp = request.socket.remoteAddress
    let senderIp = request.headers['x-forwarded-for']
    console.log('remote and sender ip:', remoteIp, senderIp)
    
    // Get all tracks from cache (already sorted)
    const tracks = await getAllTrackMetadata()
    
    return { success: true, tracks }
  } catch (err) {
    console.error('getTrackList service error:', err)
    const error = new Error('Internal server error: ' + err.message)
    error.status = 500
    throw error
  }
}

