import fs from 'node:fs'
import path from 'node:path'
import { callService } from 'micro-js'
import Logger from 'micro-js/logger'

const logger = new Logger({ logGroup: 'upload-helper' })

/**
 * Upload a file to a service endpoint using multipart/form-data
 * @param {string} serviceName - Service name to call
 * @param {string} filePath - Path to file to upload
 * @param {Object} fields - Additional form fields
 * @returns {Promise<Object>} Upload response
 */
export async function uploadFile(serviceName, filePath, fields = {}) {
  try {
    const fileName = path.basename(filePath)
    const fileStream = fs.createReadStream(filePath)
    const stats = fs.statSync(filePath)
    
    logger.info(`Uploading ${fileName} to ${serviceName}`)
    
    // Build multipart form data manually
    const boundary = `----WebKitFormBoundary${Math.random().toString(36).substring(2)}`
    const chunks = []
    
    // Add text fields
    for (const [key, value] of Object.entries(fields)) {
      chunks.push(`--${boundary}\r\n`)
      chunks.push(`Content-Disposition: form-data; name="${key}"\r\n\r\n`)
      chunks.push(`${value}\r\n`)
    }
    
    // Add file field header
    chunks.push(`--${boundary}\r\n`)
    chunks.push(`Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`)
    chunks.push(`Content-Type: application/octet-stream\r\n\r\n`)
    
    // Read file content
    const fileBuffer = fs.readFileSync(filePath)
    
    // Build complete body
    const preBody = Buffer.from(chunks.join(''), 'utf8')
    const postBody = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8')
    const body = Buffer.concat([preBody, fileBuffer, postBody])
    
    logger.warn('calling service', serviceName)
    const result = await callService(serviceName, {
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
        'content-length': body.length
      },
      body // TODO verify
    })
    
    logger.info(`Upload successful: ${fileName}`)
    return result
    
  } catch (error) {
    logger.error(`Upload failed for ${filePath}:`, error)
    logger.warn(error.stack)
    console.trace(error)
    throw error
  }
}

