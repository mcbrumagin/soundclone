import { 
  registryServer, 
  createService, 
  createRoute,
  createRoutes,
  callService,
  overrideConsoleGlobally
} from 'micro-js'
import { parseFileUpload } from './file-upload.js'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
// import { v4 as uuidv4 } from 'uuid'
import crypto from 'node:crypto'

overrideConsoleGlobally({
  includeLogLineNumbers: true
})

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = process.env.PORT || 3000

// Set environment variable for micro-js registry BEFORE importing
process.env.SERVICE_REGISTRY_ENDPOINT = `http://localhost:${PORT}`

// Create data directories if they don't exist
const dataDir = path.join(__dirname, 'data')
const uploadsDir = path.join(dataDir, 'uploads')
const metadataDir = path.join(dataDir, 'metadata')

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir)
}
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir)
}
if (!fs.existsSync(metadataDir)) {
  fs.mkdirSync(metadataDir)
}

// Helper function to read request body
async function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = ''
    request.on('data', chunk => {
      body += chunk.toString()
    })
    request.on('end', () => {
      resolve(body)
    })
    request.on('error', reject)
  })
}

// Get tracks list service
async function getTrackList(payload, request) {
  try {
    console.log('getTrackList service called')
    const files = fs.readdirSync(metadataDir)
    const tracks = []
    
    files.forEach(file => {
      if (file.endsWith('.json')) {
        const trackData = JSON.parse(fs.readFileSync(path.join(metadataDir, file), 'utf8'))
        tracks.push(trackData)
      }
    })
    
    tracks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    return { success: true, tracks }
  } catch (err) {
    console.error('getTrackList service error:', err)
    const error = new Error('Internal server error: ' + err.message)
    error.status = 500
    throw error
  }
}

// Get track detail service
async function getTrackDetail(payload, request) {
  try {
    console.log('getTrackDetail service called')
    const { trackId } = payload || {}
    
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
    return { success: true, track: trackData }
  } catch (err) {
    console.error('getTrackDetail service error:', err)
    if (err.status) throw err
    const error = new Error('Internal server error: ' + err.message)
    error.status = 500
    throw error
  }
}

// Upload track service
async function uploadTrack(payload, request) {
  try {
    console.log('uploadTrack service called')
    const { files, fields } = await parseFileUpload(request)
    
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

// Update track service
async function updateTrack(payload, request) {
  try {
    console.log('updateTrack service called')
    const { trackId, title, description } = payload || {}
    
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
    
    if (title) trackData.title = title
    if (description !== undefined) trackData.description = description
    trackData.updatedAt = new Date().toISOString()
    
    fs.writeFileSync(trackPath, JSON.stringify(trackData, null, 2))
    return { success: true, track: trackData }
  } catch (err) {
    console.error('updateTrack service error:', err)
    if (err.status) throw err
    const error = new Error('Internal server error: ' + err.message)
    error.status = 500
    throw error
  }
}

// Delete track service
async function deleteTrack(payload, request) {
  try {
    console.log('deleteTrack service called')
    const { trackId } = payload || {}
    
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
    const filePath = path.join(uploadsDir, trackData.fileName)
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
    
    fs.unlinkSync(trackPath)
    return { success: true, message: 'Track deleted successfully' }
  } catch (err) {
    console.error('deleteTrack service error:', err)
    if (err.status) throw err
    const error = new Error('Internal server error: ' + err.message)
    error.status = 500
    throw error
  }
}

// Helper function to parse comment timestamp
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

// Create comment service
async function createComment(payload, request) {
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

// Update comment service
async function updateComment(payload, request) {
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

// Delete comment service
async function deleteComment(payload, request) {
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

// Get audio file service
async function getAudioFile(payload, request) {
  console.warn('getAudioFile service called', payload)
  // const { trackId } = payload || {}
  const trackId = payload.url.split('/').pop()
  
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
  const filePath = path.join(uploadsDir, trackData.fileName)
  
  if (!fs.existsSync(filePath)) {
    const error = new Error('Audio file not found')
    error.status = 404
    throw error
  }
  
  const fileData = fs.readFileSync(filePath)
  
  return {
    status: 200,
    headers: {
      'Content-Type': trackData.fileType,
      'Content-Disposition': `inline; filename="${trackData.fileName}"`
    },
    payload: fileData,
    dataType: trackData.fileType
  }
}

// Health check service
async function getHealth(payload, request) {
  try {
    console.log('getHealth service called')

    // TODO why does this break without JSON.stringify?
    return JSON.stringify({ 
      success: true, 
      message: 'SoundClone v0 server is running',
      timestamp: new Date().toISOString()
    })
  } catch (err) {
    console.error('getHealth service error:', err)
    const error = new Error('Internal server error: ' + err.message)
    error.status = 500
    throw error
  }
}


// Static file and SPA routing service
async function staticFileService(payload) {
  try {
    console.log('Static file service called with:', payload)
    const { url } = payload || {}
    
    if (!url) {
      const error = new Error('URL is required in payload')
      error.status = 400
      throw error
    }
    
    // Handle micro-js-html module serving
    if (url.startsWith('/micro-js-html/')) {
      console.warn('serving micro-js-html module:', url)
      const filePath = path.join(__dirname, 'node_modules', url)
      console.warn('filePath:', filePath)
      if (fs.existsSync(filePath)) {
        const fileData = fs.readFileSync(filePath)
        const ext = path.extname(filePath)
        let contentType = 'text/plain'
        
        if (ext === '.js') contentType = 'application/javascript'
        else if (ext === '.css') contentType = 'text/css'
        else if (ext === '.html') contentType = 'text/html'
        
        return {
          status: 200,
          headers: { 'Content-Type': contentType },
          payload: fileData,
          dataType: contentType
        }
      }
    }
    
    // Serve static files from public directory
    const publicDir = path.join(__dirname, 'public')
    let filePath
    
    if (url === '/' || url === '') {
      filePath = path.join(publicDir, 'index.html')
    } else {
      // Remove leading slash and normalize path
      const cleanPath = url.replace(/^\/+/, '')
      filePath = path.join(publicDir, cleanPath)
    }
    
    // Security check - ensure file is within public directory
    if (!filePath.startsWith(path.resolve(publicDir))) {
      const error = new Error('Forbidden')
      error.status = 403
      throw error
    }
    
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath)
      
      if (stats.isDirectory()) {
        // Try to serve index.html from directory
        const indexPath = path.join(filePath, 'index.html')
        if (fs.existsSync(indexPath)) {
          filePath = indexPath
        } else {
          const error = new Error('Not Found')
          error.status = 404
          throw error
        }
      }
      
      const fileData = fs.readFileSync(filePath)
      const ext = path.extname(filePath)
      let contentType = 'text/plain'
      
      const mimeTypes = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.wav': 'audio/wav',
        '.mp3': 'audio/mpeg',
        '.mp4': 'video/mp4',
        '.webm': 'audio/webm',
        '.ico': 'image/x-icon'
      }
      
      contentType = mimeTypes[ext] || 'application/octet-stream'
      
      return {
        status: 200,
        headers: { 'Content-Type': contentType },
        payload: fileData,
        dataType: contentType
      }
    } else {
      // For SPA routing, serve index.html for unmatched routes
      const indexPath = path.join(publicDir, 'index.html')
      if (fs.existsSync(indexPath)) {
        const fileData = fs.readFileSync(indexPath)
        return {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
          payload: fileData,
          dataType: 'text/html'
        }
      } else {
        const error = new Error('Not Found')
        error.status = 404
        throw error
      }
    }
  } catch (err) {
    console.error('Static file service error:', err)
    if (err.status) throw err
    const error = new Error('Internal server error: ' + err.message)
    error.status = 500
    throw error
  }
}

// Main server setup
async function startServer() {
  try {
    console.log('Starting SoundClone v0 with micro-js...')
    
    // Start registry server
    await registryServer(PORT)
    console.log(`Registry server running on port ${PORT}`)
    
    // Create services
    // await Promise.all([
    //   createService(getTrackList),
    //   createService(getTrackDetail),
    //   createService(uploadTrack),
    //   createService(updateTrack),
    //   createService(deleteTrack),
    //   createService(createComment),
    //   createService(updateComment),
    //   createService(deleteComment),
    //   createService(getAudioFile),
    //   // createService(getHealth),
    //   createService(staticFileService)
    // ])
    
    // Register routes for each service using function names
    await createRoutes({
      'getTrackList': getTrackList,
      'getTrackDetail': getTrackDetail,
      'uploadTrack': uploadTrack,
      'updateTrack': updateTrack,
      'deleteTrack': deleteTrack,
      'createComment': createComment,
      'updateComment': updateComment,
      'deleteComment': deleteComment,
      '/api/audio/*': getAudioFile,
      '/getHealth': getHealth,
      '/*': staticFileService,
    })
    
    console.log(`SoundClone v0 server running on http://localhost:${PORT}`)
    console.log(`API health check: http://localhost:${PORT}/api/health`)
    
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

startServer()