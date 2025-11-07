import { createService, createSubscriptionService, publishMessage } from 'micro-js'
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'

import { envConfig } from 'micro-js'
import { rawAudioDir, uploadsDir, metadataDir, waveformsDir } from '../lib/utils.js'

const logger = {
  info: (...args) => console.log('[s3-backup]', ...args),
  warn: (...args) => console.warn('[s3-backup]', ...args),
  error: (...args) => console.error('[s3-backup]', ...args)
}

// S3 configuration
const s3Client = new S3Client({
  region: envConfig.get('AWS_REGION') || 'us-east-1',
  credentials: {
    accessKeyId: envConfig.getRequired('AWS_ACCESS_KEY_ID'),
    secretAccessKey: envConfig.getRequired('AWS_SECRET_ACCESS_KEY')
  }
})

const BUCKET_NAME = envConfig.getRequired('S3_BUCKET_NAME')
const S3_PREFIX = envConfig.get('S3_PREFIX') || 'soundclone/'

// Directory mappings (reverse lookup)
const DIRECTORY_TYPES = {
  [metadataDir]: 'metadata',
  [rawAudioDir]: 'rawAudio',
  [uploadsDir]: 'uploads',
  [waveformsDir]: 'waveforms'
}

/**
 * Get directory type from file path
 */
function getDirectoryType(filePath) {
  for (const [dir, type] of Object.entries(DIRECTORY_TYPES)) {
    if (filePath.startsWith(dir)) {
      return type
    }
  }
  return null
}

/**
 * Get S3 key from local file path
 */
function getS3Key(filePath) {
  const dirType = getDirectoryType(filePath)
  if (!dirType) {
    logger.warn(`Unknown directory type for file: ${filePath}`)
    return null
  }
  
  const filename = path.basename(filePath)
  return `${S3_PREFIX}${dirType}/${filename}`
}

/**
 * Upload file to S3
 */
async function uploadFile(filePath) {
  const s3Key = getS3Key(filePath)
  if (!s3Key) return false
  
  try {
    logger.info(`Uploading ${filePath} to s3://${BUCKET_NAME}/${s3Key}`)
    
    // Read file
    const fileContent = await fs.readFile(filePath)
    
    // Determine content type
    const ext = path.extname(filePath).toLowerCase()
    const contentTypes = {
      '.json': 'application/json',
      '.webm': 'audio/webm',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.png': 'image/png'
    }
    const contentType = contentTypes[ext] || 'application/octet-stream'
    
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: fileContent,
      ContentType: contentType
    })
    
    await s3Client.send(command)
    logger.info(`✅ Uploaded ${s3Key}`)
    return true
  } catch (error) {
    logger.error(`Failed to upload ${filePath}:`, error.message)
    return false
  }
}

/**
 * Delete file from S3
 */
async function deleteFile(filePath) {
  const s3Key = getS3Key(filePath)
  if (!s3Key) return false
  
  try {
    logger.info(`Deleting s3://${BUCKET_NAME}/${s3Key}`)
    
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key
    })
    
    await s3Client.send(command)
    logger.info(`✅ Deleted ${s3Key}`)
    return true
  } catch (error) {
    logger.error(`Failed to delete ${s3Key}:`, error.message)
    return false
  }
}

/**
 * Handle file-updated event
 */
async function handleFileUpdated(message) {
  const { filePath, urlPath } = message
  
  if (!filePath) {
    logger.warn('Received file-updated event without filePath')
    return
  }
  
  logger.info(`File updated: ${filePath}`)
  
  // Check if file is in one of our tracked directories
  const dirType = getDirectoryType(filePath)
  if (!dirType) {
    logger.info(`File not in tracked directory, skipping: ${filePath}`)
    return
  }
  
  // Upload to S3
  await uploadFile(filePath)
}

/**
 * Handle file-deleted event
 */
async function handleFileDeleted(message) {
  const { filePath } = message
  
  if (!filePath) {
    logger.warn('Received file-deleted event without filePath')
    return
  }
  
  logger.info(`File deleted: ${filePath}`)
  
  // Check if file is in one of our tracked directories
  const dirType = getDirectoryType(filePath)
  if (!dirType) {
    logger.info(`File not in tracked directory, skipping: ${filePath}`)
    return
  }
  
  // Delete from S3
  await deleteFile(filePath)
}

/**
 * Initialize S3 backup service
 */
export default async function initializeS3BackupService() {
  if (!BUCKET_NAME) {
    logger.warn('S3_BUCKET_NAME not configured, skipping S3 backup service')
    return {
      name: 's3-backup',
      terminate: async () => {}
    }
  }
  
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    logger.warn('AWS credentials not configured, skipping S3 backup service')
    return {
      name: 's3-backup',
      terminate: async () => {}
    }
  }
  
  logger.info('Initializing S3 backup service...')
  logger.info(`Bucket: ${BUCKET_NAME}, Prefix: ${S3_PREFIX}`)
  logger.info('Listening for file-updated and file-deleted events')
  
  // Subscribe to file events
  let s3BackupService = await createSubscriptionService('s3-backup', {
    'micro:file-updated': handleFileUpdated,
    'micro:file-deleted': handleFileDeleted
  })
  
  logger.info('✅ S3 backup service initialized')
  
  return s3BackupService
}

