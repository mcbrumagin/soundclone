import fs from 'node:fs'
import path from 'node:path'
import { metadataDir } from '../lib/utils.js'

function parseCommentTimestamp(text) {
  const hasTimestamp = text.includes('@')
  let trackTimestamp = null
  
  if (hasTimestamp) {
    const match = text.match(/@(\d{2}):(\d{2})/)
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
    
    if (!text) {
      const error = new Error('Comment text is required')
      error.status = 400
      throw error
    }
    
    const { hasTimestamp, trackTimestamp } = parseCommentTimestamp(text)
    
    trackData.comments[commentIndex].text = text
    trackData.comments[commentIndex].updatedAt = new Date().toISOString()
    trackData.comments[commentIndex].hasTimestamp = hasTimestamp
    trackData.comments[commentIndex].trackTimestamp = trackTimestamp
    
    trackData.updatedAt = new Date().toISOString()
    
    fs.writeFileSync(trackPath, JSON.stringify(trackData, null, 2))
    return { success: true, comment: trackData.comments[commentIndex] }
  } catch (err) {
    console.error('updateComment service error:', err)
    if (err.status) throw err
    const error = new Error('Internal server error: ' + err.message)
    error.status = 500
    throw error
  }
}

