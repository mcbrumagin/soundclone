import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { parseFileUpload } from '../lib/file-upload.js'
import { uploadsDir, metadataDir } from '../lib/utils.js'

export default async function uploadTrack(payload, request) {
  try {
    console.log('uploadTrack service called')
    console.log('payload type:', typeof payload, 'is object:', typeof payload === 'object')
    console.log('payload keys:', payload ? Object.keys(payload) : 'null')
    console.log('request.readableEnded:', request.readableEnded)
    const { files, fields } = await parseFileUpload(request, payload)

    console.log('files', files)
    
    if (!files.audio) {
      const error = new Error('No audio file uploaded')
      error.status = 400
      throw error
    }
    
    const audioFile = files.audio
    const { title, description } = fields
    
    if (!title) {
      const error = new Error('Title is required')
      error.status = 400
      throw error
    }
    
    const trackId = crypto.randomUUID()
    const fileExtension = path.extname(audioFile.name)
    const fileName = `${trackId}${fileExtension}`
    const filePath = path.join(uploadsDir, fileName)
    
    await audioFile.mv(filePath)
    
    const trackData = {
      id: trackId,
      title,
      description: description || '',
      fileName,
      fileType: audioFile.mimetype,
      fileSize: audioFile.size,
      duration: 0,
      audioUrl: `/api/audio/${trackId}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      shareableLink: trackId,
      comments: []
    }
    
    fs.writeFileSync(path.join(metadataDir, `${trackId}.json`), JSON.stringify(trackData, null, 2))
    return { success: true, track: trackData }
  } catch (err) {
    console.error('uploadTrack service error:', err)
    if (err.status) throw err
    const error = new Error('Internal server error: ' + err.message)
    error.status = 500
    throw error
  }
}

