import { next, HttpError } from 'micro-js'
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { uploadsDir } from '../lib/utils.js'

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
          sampleRate: parseInt(audioStream?.sample_rate) || 0,
          channels: parseInt(audioStream?.channels) || 0,
          codecName: audioStream?.codec_name || 'unknown',
          bitsPerSample: parseInt(audioStream?.bits_per_sample) || 0,
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

export default async function audioMetadataService(payload, request, response) {
  try {
    const { fileName } = payload || {}
    
    if (!fileName) {
      throw new HttpError(400, 'fileName parameter is required')
    }
    
    const audioFilePath = path.join(uploadsDir, fileName)
    if (!fs.existsSync(audioFilePath)) {
      throw new HttpError(404, 'Audio file not found')
    }
    
    const metadata = await getAudioMetadata(audioFilePath)
    
    if (!metadata) {
      throw new HttpError(500, 'Failed to extract audio metadata')
    }
    
    console.log(`Audio metadata for ${fileName}:`, metadata)
    
    return next({ 
      success: true, 
      fileName,
      metadata 
    })
    
  } catch (err) {
    console.error('audioMetadataService error:', err)
    if (err.status) throw err
    throw new HttpError(500, 'Internal server error: ' + err.message)
  }
}
