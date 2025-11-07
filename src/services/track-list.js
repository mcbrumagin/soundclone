import fs from 'node:fs'
import path from 'node:path'
import { metadataDir } from '../lib/utils.js'

export default async function getTrackList(payload, request, response) {
  try {
    console.log('getTrackList service called')
    let remoteIp = request.socket.remoteAddress
    let senderIp = request.headers['x-forwarded-for']
    console.log('remote and sender ip:', remoteIp, senderIp)
    // console.log('request headers:', request.headers)
    // response.setHeader('forwarded', request.headers.forwarded)
    // response.setHeader('Cache-Control', 'max-age=60, public')
    // response.setHeader('x-test-header', 'test value')
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

