import { createService, createSubscriptionService, publishMessage } from 'micro-js'
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import fs from 'node:fs/promises'
import path from 'node:path'

import { envConfig } from 'micro-js'
import { rawAudioDir, optimizedAudioDir, waveformsDir } from '../../../lib/utils.js'
import Logger from 'micro-js/logger'

const logger = new Logger({ logGroup: 's3-backup' })

// S3 configuration
// Note: In ECS, credentials are automatically provided by the task role
// Only provide explicit credentials if they're set (for local development)
const s3ClientConfig = {
  region: envConfig.get('AWS_REGION') || 'us-east-1'
}

const accessKeyId = envConfig.get('AWS_ACCESS_KEY_ID')
const secretAccessKey = envConfig.get('AWS_SECRET_ACCESS_KEY')

if (accessKeyId && secretAccessKey) {
  logger.info('Using explicit AWS credentials from environment')
  s3ClientConfig.credentials = {
    accessKeyId,
    secretAccessKey
  }
} else {
  logger.info('Using default AWS credential chain (task role / instance profile)')
}

const s3Client = new S3Client(s3ClientConfig)

const BUCKET_NAME = envConfig.getRequired('S3_BUCKET_NAME')
const S3_PREFIX = envConfig.get('S3_PREFIX') || 'soundclone/'

// Directory mappings (reverse lookup)
const DIRECTORY_TYPES = {
  [rawAudioDir]: 'audio/raw',
  [optimizedAudioDir]: 'audio/optimized',
  [waveformsDir]: 'images/waveforms'
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
async function uploadFile(filePath, rawData) {
  const s3Key = getS3Key(filePath)
  if (!s3Key) return false
  
  try {
    logger.info(`Uploading ${filePath} to s3://${BUCKET_NAME}/${s3Key}`)
    
    let fileContent = null
    if (!rawData) {
      // Read file
      fileContent = await fs.readFile(filePath)
    } else {
      fileContent = rawData
    }
    
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
 * Handle track-metadata-updated event
 * Uploads metadata directly to S3 without writing to filesystem
 */
async function handleTrackMetadataUpdated(message) {
  const { trackId, metadata } = message
  
  try {
    const s3Key = `${S3_PREFIX}metadata/${trackId}.json`
    const fileContent = JSON.stringify(metadata, null, 2)
    
    logger.info(`Uploading metadata for track ${trackId} to s3://${BUCKET_NAME}/${s3Key}`)
    
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: fileContent,
      ContentType: 'application/json'
    })
    
    await s3Client.send(command)
    logger.info(`✅ Updated metadata for track ${trackId} in S3`)
    return true
  } catch (error) {
    logger.error(`Failed to upload metadata for track ${trackId}:`, error.message)
    return false
  }
}

/**
 * Handle track-metadata-deleted event
 * Deletes metadata directly from S3
 */
async function handleTrackMetadataDeleted(message) {
  const { trackId } = message
  
  try {
    const s3Key = `${S3_PREFIX}metadata/${trackId}.json`
    
    logger.info(`Deleting metadata for track ${trackId} from s3://${BUCKET_NAME}/${s3Key}`)
    
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key
    })
    
    await s3Client.send(command)
    logger.info(`✅ Deleted metadata for track ${trackId} from S3`)
    return true
  } catch (error) {
    logger.error(`Failed to delete metadata for track ${trackId}:`, error.message)
    return false
  }
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
  
  logger.info('Initializing S3 backup service...')
  logger.info(`Bucket: ${BUCKET_NAME}, Prefix: ${S3_PREFIX}`)
  logger.info('Listening for file-updated and file-deleted events')
  
  // Subscribe to file events
  let s3BackupService = await createSubscriptionService('s3-backup', {
    'micro:file-updated': handleFileUpdated,
    'micro:file-deleted': handleFileDeleted,
    'track-metadata-updated': handleTrackMetadataUpdated,
    'track-metadata-deleted': handleTrackMetadataDeleted
  })
  
  logger.info('✅ S3 backup service initialized')
  
  return s3BackupService
}

