import { getTrackMetadata, mergeAndUpdateTrackMetadata } from '../lib/metadata-cache.js'

function parseCommentTimestamp(text) {
  const hasTimestamp = text.includes('@')
  let trackTimestamp = null
  
  if (hasTimestamp) {
    const match = text.match(/@(\d{1,2}):(\d{2})/)
    if (match) {
      const minutes = parseInt(match[1])
      const seconds = parseInt(match[2])
      trackTimestamp = minutes * 60 + seconds
    }
  }
  
  return { hasTimestamp, trackTimestamp }
}

export default async function updateComment(payload, request) {
  try {
    console.log('updateComment service called')
    const { trackId, commentId, text } = payload || {}
    
    if (!trackId || !commentId) {
      const error = new Error('Track ID and Comment ID are required')
      error.status = 400
      throw error
    }
    
    if (!text) {
      const error = new Error('Comment text is required')
      error.status = 400
      throw error
    }
    
    const trackData = await getTrackMetadata(trackId)
    
    if (!trackData) {
      const error = new Error('Track not found')
      error.status = 404
      throw error
    }
    
    const commentIndex = trackData.comments.findIndex(c => c.id === commentId)
    
    if (commentIndex === -1) {
      const error = new Error('Comment not found')
      error.status = 404
      throw error
    }
    
    const { hasTimestamp, trackTimestamp } = parseCommentTimestamp(text)
    
    // Update comment in array
    const updatedComments = [...trackData.comments]
    updatedComments[commentIndex] = {
      ...updatedComments[commentIndex],
      text,
      updatedAt: new Date().toISOString(),
      hasTimestamp,
      trackTimestamp
    }
    
    // Merge into cache
    await mergeAndUpdateTrackMetadata(trackId, { comments: updatedComments })
    
    return { success: true, comment: updatedComments[commentIndex] }
  } catch (err) {
    console.error('updateComment service error:', err)
    if (err.status) throw err
    const error = new Error('Internal server error: ' + err.message)
    error.status = 500
    throw error
  }
}

