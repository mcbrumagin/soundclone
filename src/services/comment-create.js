import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
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

export default async function createComment(payload, request) {
  try {
    console.log('createComment service called')
    const { trackId, text } = payload || {}
    
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
    
    if (!text) {
      const error = new Error('Comment text is required')
      error.status = 400
      throw error
    }
    
    const commentId = crypto.randomUUID()
    const { hasTimestamp, trackTimestamp } = parseCommentTimestamp(text)
    
    const comment = {
      id: commentId,
      text,
      timestamp: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      hasTimestamp,
      trackTimestamp
    }
    
    trackData.comments.push(comment)
    trackData.updatedAt = new Date().toISOString()
    
    fs.writeFileSync(trackPath, JSON.stringify(trackData, null, 2))
    return { success: true, comment }
  } catch (err) {
    console.error('createComment service error:', err)
    if (err.status) throw err
    const error = new Error('Internal server error: ' + err.message)
    error.status = 500
    throw error
  }
}

