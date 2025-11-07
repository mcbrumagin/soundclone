import { getTrackMetadata, mergeAndUpdateTrackMetadata } from '../lib/metadata-cache.js'

export default async function deleteComment(payload, request) {
  try {
    console.log('deleteComment service called')
    const { trackId, commentId } = payload || {}
    
    if (!trackId || !commentId) {
      const error = new Error('Track ID and Comment ID are required')
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
    
    // Remove comment from array
    const updatedComments = trackData.comments.filter(c => c.id !== commentId)
    
    // Merge into cache
    await mergeAndUpdateTrackMetadata(trackId, { comments: updatedComments })
    
    return { success: true, message: 'Comment deleted successfully' }
  } catch (err) {
    console.error('deleteComment service error:', err)
    if (err.status) throw err
    const error = new Error('Internal server error: ' + err.message)
    error.status = 500
    throw error
  }
}

