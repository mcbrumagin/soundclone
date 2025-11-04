import { next, HttpError } from 'micro-js'
import fs from 'node:fs'
import path from 'node:path'
import { uploadsDir } from '../lib/utils.js'


// NOTE this is not used anymore, but we may reimplement later for performance reasons


/**
 * Get content type based on file extension
 * @param {string} filePath - Path to file
 * @returns {string} MIME type
 */
function getAudioContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  const mimeTypes = {
    '.webm': 'audio/webm',    // Opus in WebM (primary format)
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.flac': 'audio/flac'
  }
  return mimeTypes[ext] || 'audio/webm'
}

/**
 * Audio streaming service - serves transcoded Opus/WebM files with range support
 * @param {Object} payload - Request payload
 * @param {Object} request - HTTP request
 * @param {Object} response - HTTP response
 */
export default async function audioStreamService(payload, request, response) {
  try {
    if (payload) console.warn('audioStreamService payload:', payload)
    const { url } = request.url

    console.log('🎵 audioStreamService called:', {
      method: request.method,
      url: request.url,
      headers: request.headers
    })
    
    // Get the actual HTTP method from micro-js override header
    const actualMethod = request.method
    console.log('🔍 Actual HTTP method:', actualMethod)
    
    // Handle CORS preflight requests
    if (actualMethod === 'OPTIONS') {
      console.log('✅ Handling OPTIONS request for CORS preflight')
      response.setHeader('Access-Control-Allow-Origin', '*')
      response.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
      response.setHeader('Access-Control-Allow-Headers', 'Range')
      response.setHeader('Content-Length', '0')
      response.statusCode = 200
      response.end()
      return next({ success: true })
    }
    
    if (!url || !url.startsWith('/api/audio/')) {
      throw new HttpError(404, 'Audio file not found')
    }
    
    // Extract filename from URL
    const fileName = url.split('/').pop()
    const audioFilePath = path.join(uploadsDir, fileName)
    
    // Check if file exists
    if (!fs.existsSync(audioFilePath)) {
      throw new HttpError(404, 'Audio file not found - may still be processing')
    }
    
    const contentType = getAudioContentType(audioFilePath)
    const stat = fs.statSync(audioFilePath)
    
    // Check if file is empty or still being written
    if (stat.size === 0) {
      throw new HttpError(404, 'Audio file is still being processed')
    }
    
    console.log(`Streaming audio: ${fileName} (${stat.size} bytes)`)
    
    // Set response headers for browser compatibility and caching
    response.setHeader('Content-Type', contentType)
    response.setHeader('Content-Length', stat.size)
    response.setHeader('Accept-Ranges', 'bytes')
    response.setHeader('Cache-Control', 'public, max-age=3600')
    response.setHeader('Access-Control-Allow-Origin', '*')
    response.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
    response.setHeader('Access-Control-Allow-Headers', 'Range')
    response.setHeader('X-Audio-Service', 'soundclone-streaming')
    
    // Handle range requests for audio seeking
    const range = request.headers.range
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-')
      const start = Math.max(0, parseInt(parts[0], 10) || 0)
      const end = Math.min(stat.size - 1, parts[1] && parts[1].trim() !== '' ? parseInt(parts[1], 10) : stat.size - 1)
      
      // Validate range
      if (start >= stat.size || end >= stat.size || start > end) {
        response.statusCode = 416 // Range Not Satisfiable
        response.setHeader('Content-Range', `bytes */${stat.size}`)
        response.end()
        return next({ reason: 'invalid range', start, end, fileSize: stat.size })
      }
      
      const chunkSize = (end - start) + 1
      
      response.statusCode = 206 // Partial Content
      response.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`)
      response.setHeader('Content-Length', chunkSize)
      
      console.log(`Range request: ${start}-${end}/${stat.size}`)
      
      const stream = fs.createReadStream(audioFilePath, { start, end })
      stream.pipe(response)
    } else {
      // Full file request
      const stream = fs.createReadStream(audioFilePath)
      stream.pipe(response)
    }
    
    return next()
  } catch (err) {
    console.error('audioStreamService error:', err)
    if (err.status) throw err
    throw new HttpError(500, 'Internal server error: ' + err.message)
  }
}
