import { next, HttpError } from 'micro-js'
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
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

async function getAudioMetadata(filePath) {
  return new Promise((resolve) => {
    // Use ffprobe to get detailed audio metadata including duration
    const ffprobe = spawn('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_streams',
      '-show_format',
      filePath
    ])
    
    let output = ''
    ffprobe.stdout.on('data', (data) => {
      output += data.toString()
    })
    
    ffprobe.on('close', (code) => {
      if (code !== 0) {
        resolve(null) // If ffprobe fails, return null
        return
      }
      
      try {
        const info = JSON.parse(output)
        const audioStream = info.streams.find(s => s.codec_type === 'audio')
        
        const metadata = {
          duration: parseFloat(info.format?.duration) || 0,
          bitRate: parseInt(info.format?.bit_rate) || 0,
          size: parseInt(info.format?.size) || 0,
          needsTranscoding: false
        }
        
        // Check if it needs transcoding (24-bit WAV files)
        if (audioStream && 
            audioStream.codec_name === 'pcm_s24le' && 
            audioStream.bits_per_sample === 24) {
          metadata.needsTranscoding = true
        }
        
        resolve(metadata)
      } catch (err) {
        console.error('Error parsing ffprobe output:', err)
        resolve(null)
      }
    })
    
    ffprobe.on('error', () => {
      resolve(null) // If ffprobe is not available, return null
    })
  })
}

async function needsTranscoding(filePath) {
  const metadata = await getAudioMetadata(filePath)
  return metadata?.needsTranscoding || false
}

function createTranscodedStream(filePath) {
  // Use ffmpeg to convert 24-bit WAV to 16-bit WAV on-the-fly
  const ffmpeg = spawn('ffmpeg', [
    '-i', filePath,
    '-acodec', 'pcm_s16le',  // Convert to 16-bit PCM
    '-ar', '44100',          // Standard sample rate
    '-ac', '2',              // Convert to stereo for better compatibility
    '-f', 'wav',             // Output format
    'pipe:1'                 // Output to stdout
  ])
  
  return ffmpeg.stdout
}

export default async function audioStreamService(payload, request, response) {
  try {
    const { url } = payload || {}
    
    console.log('🎵 audioStreamService called:', {
      method: request.method,
      url: url,
      originalUrl: request.url,
      headers: request.headers,
      payload: payload
    })
    
    // Get the actual HTTP method from micro-js override header
    const actualMethod = request.headers['x-micro-override-method'] || request.method
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
    
    // Check if we need to transcode for Chrome compatibility
    const shouldTranscode = await needsTranscoding(audioFilePath)
    console.log(`Audio file ${trackName} needs transcoding:`, shouldTranscode)
    
    // Set response headers for better browser compatibility
    response.setHeader('Content-Type', contentType)
    response.setHeader('Cache-Control', 'public, max-age=3600')
    response.setHeader('Access-Control-Allow-Origin', '*')
    response.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
    response.setHeader('Access-Control-Allow-Headers', 'Range')
    response.setHeader('X-Audio-Service', 'custom-streaming-service')
    
    if (shouldTranscode) {
      // For transcoded audio, we can't support range requests easily
      // and we don't know the final size, so we use chunked encoding
      response.setHeader('Transfer-Encoding', 'chunked')
      
      const transcodedStream = createTranscodedStream(audioFilePath)
      
      transcodedStream.on('error', (err) => {
        console.error('Transcoding error:', err)
        if (!response.headersSent) {
          response.statusCode = 500
          response.end('Transcoding failed')
        }
      })
      
      transcodedStream.pipe(response)
    } else {
      // Original logic for non-transcoded files
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
    }
    
    return next()
  } catch (err) {
    console.error('audioStreamService error:', err)
    if (err.status) throw err
    throw new HttpError(500, 'Internal server error: ' + err.message)
  }
}
