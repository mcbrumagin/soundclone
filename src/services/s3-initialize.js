import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'

import { rawAudioDir, uploadsDir, metadataDir, waveformsDir } from '../lib/utils.js'
import { envConfig } from 'micro-js'

const logger = {
  info: (...args) => console.log('[s3-initialize]', ...args),
  warn: (...args) => console.warn('[s3-initialize]', ...args),
  error: (...args) => console.error('[s3-initialize]', ...args)
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

// Directory mappings
const DIRECTORIES = {
  metadata: metadataDir,
  rawAudio: rawAudioDir,
  uploads: uploadsDir,
  waveforms: waveformsDir
}

/**
 * Download a file from S3 to local filesystem
 */
async function downloadFile(s3Key, localPath) {
  try {
    logger.info(`Downloading ${s3Key} to ${localPath}`)
    
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key
    })
    
    const response = await s3Client.send(command)
    
    // Ensure directory exists
    const dir = path.dirname(localPath)
    if (!fsSync.existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true })
    }
    
    // Stream the file to disk
    if (response.Body instanceof Readable) {
      const writeStream = fsSync.createWriteStream(localPath)
      await pipeline(response.Body, writeStream)
      logger.info(`Downloaded ${s3Key}`)
      return true
    } else {
      throw new Error('S3 response body is not a readable stream')
    }
  } catch (error) {
    logger.error(`Failed to download ${s3Key}:`, error.message)
    return false
  }
}

/**
 * List and download all files from a specific S3 prefix
 */
async function syncDirectory(dirType, s3Prefix, localDir) {
  try {
    logger.info(`Syncing ${dirType} from S3 prefix: ${s3Prefix}`)
    
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: s3Prefix
    })
    
    const response = await s3Client.send(command)
    const contents = response.Contents || []
    
    if (contents.length === 0) {
      logger.info(`No files found in ${s3Prefix}`)
      return { success: true, count: 0 }
    }
    
    logger.info(`Found ${contents.length} files in ${s3Prefix}`)
    
    let successCount = 0
    let failCount = 0
    
    for (const object of contents) {
      // Skip directory markers
      if (object.Key.endsWith('/')) continue
      
      // Extract filename from key
      const filename = path.basename(object.Key)
      const localPath = path.join(localDir, filename)
      
      // Skip if file already exists and has same size
      if (fsSync.existsSync(localPath)) {
        const stat = await fs.stat(localPath)
        if (stat.size === object.Size) {
          logger.info(`Skipping ${filename} (already exists with correct size)`)
          successCount++
          continue
        }
      }
      
      const success = await downloadFile(object.Key, localPath)
      if (success) {
        successCount++
      } else {
        failCount++
      }
    }
    
    logger.info(`${dirType} sync complete: ${successCount} success, ${failCount} failed`)
    
    return {
      success: failCount === 0,
      count: successCount,
      failed: failCount
    }
  } catch (error) {
    logger.error(`Failed to sync ${dirType}:`, error)
    return { success: false, error: error.message }
  }
}

/**
 * Initialize local filesystem from S3
 */
async function initializeFromS3() {
  if (!BUCKET_NAME) {
    logger.warn('S3_BUCKET_NAME not configured, skipping S3 initialization')
    return { success: true, skipped: true }
  }
  
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    logger.warn('AWS credentials not configured, skipping S3 initialization')
    return { success: true, skipped: true }
  }
  
  logger.info('Starting S3 initialization...')
  logger.info(`Bucket: ${BUCKET_NAME}, Prefix: ${S3_PREFIX}`)
  
  const results = {}
  
  // Sync each directory
  for (const [dirType, localDir] of Object.entries(DIRECTORIES)) {
    const s3Prefix = `${S3_PREFIX}${dirType}/`
    results[dirType] = await syncDirectory(dirType, s3Prefix, localDir)
  }
  
  // Check if any failed
  const hasFailures = Object.values(results).some(r => !r.success)
  
  if (hasFailures) {
    logger.error('S3 initialization completed with errors:', results)
    return { success: false, results }
  } else {
    logger.info('S3 initialization completed successfully:', results)
    return { success: true, results }
  }
}

/**
 * Initialize service - runs once on startup and terminates
 */
export default async function initializeLocalFileSystem() {
  logger.info('Initializing local filesystem from S3...')
  
  try {
    const result = await initializeFromS3()
    
    if (result.skipped) {
      logger.info('S3 initialization skipped (not configured)')
    } else if (result.success) {
      logger.info('✅ Local filesystem initialized from S3 successfully')
    } else {
      logger.error('❌ Local filesystem initialization from S3 failed')
      // Don't throw error - allow server to continue with local files
    }
    
  } catch (error) {
    logger.error('Failed to initialize from S3:', error)
    // Don't throw - allow server to continue
    return {
      name: 's3-initialize',
      terminate: async () => {}
    }
  }
}

