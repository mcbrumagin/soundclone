import path from 'node:path'
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { envConfig } from 'micro-js'
import { getTrackMetadata, deleteTrackMetadata } from '../../../lib/metadata-cache.js'
import { getTrackFilenames } from '../../../lib/track-metadata-model.js'
import { rawAudioDir, optimizedAudioDir, waveformsDir } from '../../../lib/utils.js'
import { safeDelete } from '../../../lib/fs-helpers.js'
import Logger from 'micro-js/logger'

const logger = new Logger({ logGroup: 'track-delete' })

// S3 configuration
const s3ClientConfig = {
  region: envConfig.get('AWS_REGION') || 'us-east-1'
}

const accessKeyId = envConfig.get('AWS_ACCESS_KEY_ID')
const secretAccessKey = envConfig.get('AWS_SECRET_ACCESS_KEY')

if (accessKeyId && secretAccessKey) {
  s3ClientConfig.credentials = {
    accessKeyId,
    secretAccessKey
  }
}

const s3Client = new S3Client(s3ClientConfig)
const BUCKET_NAME = envConfig.get('S3_BUCKET_NAME')
const S3_PREFIX = envConfig.get('S3_PREFIX') || 'soundclone/'

/**
 * Delete a file from S3
 */
async function deleteFromS3(s3Key) {
  if (!BUCKET_NAME) {
    logger.debug('S3_BUCKET_NAME not configured, skipping S3 deletion')
    return { success: true, skipped: true }
  }
  
  try {
    logger.info(`Deleting s3://${BUCKET_NAME}/${s3Key}`)
    
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key
    })
    
    await s3Client.send(command)
    logger.info(`✅ Deleted from S3: ${s3Key}`)
    return { success: true }
  } catch (error) {
    logger.error(`Failed to delete from S3 ${s3Key}:`, error.message)
    return { success: false, error: error.message }
  }
}

/**
 * Delete track files from both local filesystem and S3
 */
async function deleteTrackFiles(trackId, trackData) {
  const { optimizedFileName, waveformFileName } = getTrackFilenames(trackId)
  const results = {
    local: { deleted: [], failed: [] },
    s3: { deleted: [], failed: [] }
  }
  
  // Files to delete
  const files = [
    {
      local: path.join(rawAudioDir, trackData.originalFileName),
      s3: `${S3_PREFIX}audio/raw/${trackData.originalFileName}`,
      name: 'raw audio'
    },
    {
      local: path.join(optimizedAudioDir, optimizedFileName),
      s3: `${S3_PREFIX}audio/optimized/${optimizedFileName}`,
      name: 'optimized audio'
    },
    {
      local: path.join(waveformsDir, waveformFileName),
      s3: `${S3_PREFIX}images/waveforms/${waveformFileName}`,
      name: 'waveform'
    }
  ]
  
  // Delete from local filesystem
  for (const file of files) {
    try {
      const deleted = await safeDelete(file.local, { logNotFound: true })
      if (deleted) {
        results.local.deleted.push(file.name)
        logger.info(`Deleted local ${file.name}: ${file.local}`)
      }
    } catch (err) {
      logger.error(`Failed to delete local ${file.name}:`, err.message)
      results.local.failed.push({ file: file.name, error: err.message })
    }
  }
  
  // Delete from S3
  for (const file of files) {
    const s3Result = await deleteFromS3(file.s3)
    if (s3Result.success && !s3Result.skipped) {
      results.s3.deleted.push(file.name)
    } else if (!s3Result.success) {
      results.s3.failed.push({ file: file.name, error: s3Result.error })
    }
  }
  
  return results
}

export default async function deleteTrack(payload, request) {
  try {
    logger.info('deleteTrack service called')
    const { trackId } = payload || {}
    
    if (!trackId) {
      const error = new Error('Track ID is required')
      error.status = 400
      throw error
    }
    
    const trackData = await getTrackMetadata(trackId)
    
    if (!trackData) {
      const error = new Error('Track not found')
      error.status = 404
      throw error
    }
    
    logger.info(`Deleting track: ${trackData.title} (${trackId})`)
    
    // Delete files from local filesystem and S3
    const deleteResults = await deleteTrackFiles(trackId, trackData)
    
    // Delete metadata from cache
    await deleteTrackMetadata(trackId)
    logger.info(`Deleted metadata for track ${trackId} from cache`)
    
    // Log summary
    logger.info('Deletion summary:', {
      local: {
        deleted: deleteResults.local.deleted.length,
        failed: deleteResults.local.failed.length
      },
      s3: {
        deleted: deleteResults.s3.deleted.length,
        failed: deleteResults.s3.failed.length
      }
    })
    
    // Return success even if some files failed (they may not have existed)
    return { 
      success: true, 
      message: 'Track deleted successfully',
      details: deleteResults
    }
  } catch (err) {
    logger.error('deleteTrack service error:', err)
    if (err.status) throw err
    const error = new Error('Internal server error: ' + err.message)
    error.status = 500
    throw error
  }
}

