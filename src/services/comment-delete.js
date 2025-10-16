import fs from 'node:fs'
import path from 'node:path'
import { metadataDir } from '../lib/utils.js'

export default async function deleteComment(payload, request) {
  try {
    console.log('deleteComment service called')
    const { trackId, commentId } = payload || {}
    
    if (!trackId || !commentId) {
      const error = new Error('Track ID and Comment ID are required')
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
    const commentIndex = trackData.comments.findIndex(c => c.id === commentId)
    
    if (commentIndex === -1) {
      const error = new Error('Comment not found')
      error.status = 404
      throw error
    }
    
    trackData.comments.splice(commentIndex, 1)
    trackData.updatedAt = new Date().toISOString()
    
    fs.writeFileSync(trackPath, JSON.stringify(trackData, null, 2))
    return { success: true, message: 'Comment deleted successfully' }
  } catch (err) {
    console.error('deleteComment service error:', err)
    if (err.status) throw err
    const error = new Error('Internal server error: ' + err.message)
    error.status = 500
    throw error
  }
}

