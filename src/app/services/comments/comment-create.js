import crypto from 'node:crypto'
import { getTrackMetadata, mergeAndUpdateTrackMetadata } from '../../../lib/metadata-cache.js'
import Logger from 'micro-js/logger'

const logger = new Logger({ logGroup: 'comment-create' })

function parseCommentTimestamp(text) {
  const hasTimestamp = text.includes('@')
  let trackTimestamp = null
  
  if (hasTimestamp) {
    // Match @m:ss or @mm:ss formats
    const match = text.match(/@(\d{1,2}):(\d{2})/)
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
    const { trackId, text } = payload || {}

    logger.info('creating comment for track:', trackId)
    logger.debug('comment text:', text)

    if (!trackId) throw new HttpError(400, 'Track ID is required')
    if (!text) throw new HttpError(400, 'Comment text is required')
    
    const trackData = await getTrackMetadata(trackId)
    if (!trackData) throw new HttpError(404, 'Track not found')
    
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
    
    // Add comment to track's comments array
    const comments = [...(trackData.comments || []), comment]
    
    // Merge into cache
    await mergeAndUpdateTrackMetadata(trackId, { comments })
    
    return { success: true, comment }
  } catch (err) {
    console.error('createComment service error:', err)
    if (err.status) throw err
    const error = new Error('Internal server error: ' + err.message)
    error.status = 500
    throw error
  }
}

