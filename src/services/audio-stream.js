import { next, HttpError } from 'micro-js'
import fs from 'node:fs'
import path from 'node:path'
import { uploadsDir, metadataDir } from '../lib/utils.js'

function getAudioContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  const mimeTypes = {
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.webm': 'audio/webm',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.flac': 'audio/flac'
  }
  return mimeTypes[ext] || 'audio/mpeg'
}

export default async function audioStreamService(payload, request, response) {
  try {
    const { url } = payload || {}
    
    if (!url || !url.startsWith('/api/audio/')) {
      throw new HttpError(404, 'Audio file not found')
    }
    
    const trackName = url.split('/').pop()
    const audioFilePath = path.join(uploadsDir, trackName)
    if (!fs.existsSync(audioFilePath)) {
      throw new HttpError(404, 'Audio file not found')
    }
    
    const contentType = getAudioContentType(audioFilePath)
    const stat = fs.statSync(audioFilePath)
    
    // Check if file is empty
    if (stat.size === 0) {
      throw new HttpError(404, 'Audio file is empty or still being uploaded')
    }
    
    // Set response headers
    response.setHeader('Content-Type', contentType)
    response.setHeader('Content-Length', stat.size)
    response.setHeader('Accept-Ranges', 'bytes')
    
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
      
      response.statusCode = 206
      response.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`)
      response.setHeader('Content-Length', chunkSize)
      
      const stream = fs.createReadStream(audioFilePath, { start, end })
      stream.pipe(response)
    } else {
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
