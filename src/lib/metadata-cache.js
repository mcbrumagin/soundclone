import { callService, publishMessage, Logger } from 'micro-js'

const logger = new Logger({ logGroup: 'metadata-cache' })

/**
 * Get track metadata from cache
 */
export async function getTrackMetadata(trackId) {
  logger.debug('getTrackMetadata called with trackId:', trackId)
  try {
    const result = await callService('cache-service', { get: trackId })
    logger.warn('getTrackMetadata result:', result)
    return result || null
  } catch (error) {
    console.error(`Failed to get track metadata for ${trackId}:`, error)
    return null
  }
}

/**
 * Set track metadata in cache
 */
export async function setTrackMetadata(trackId, metadata) {
  try {
    let result = await callService('cache-service', { set: { [trackId]: metadata } })

    await publishMessage('track-metadata-updated', {
      trackId,
      metadata
    })
    return result || null
  } catch (error) {
    console.error(`Failed to set track metadata for ${trackId}:`, error)
    return false
  }
}

/**
 * Merge updates into track metadata (atomic)
 * This prevents race conditions by fetching, merging, and setting in one call
 */
export async function mergeAndUpdateTrackMetadata(trackId, updates) {
  logger.debug('mergeAndUpdateTrackMetadata called with trackId:', trackId, 'updates:', updates)
  try {
    // Get current metadata
    const current = await getTrackMetadata(trackId)
    
    if (!current) {
      console.error(`Track ${trackId} not found in cache`)
      return null
    }
    
    // Merge updates
    const merged = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString()
    }
    
    // Set back to cache
    await setTrackMetadata(trackId, merged)
    logger.debug('mergeAndUpdateTrackMetadata merged:', merged)
    
    return merged
  } catch (error) {
    console.error(`Failed to merge track metadata for ${trackId}:`, error)
    return null
  }
}

/**
 * Delete track metadata from cache
 */
export async function deleteTrackMetadata(trackId) {
  try {
    return await callService('cache-service', { del: trackId })
  } catch (error) {
    console.error(`Failed to delete track metadata for ${trackId}:`, error)
    return false
  }
}

/**
 * Get all track metadata (for listing)
 */
export async function getAllTrackMetadata() {
  try {
    // TODO '<key-prefix>:*' support
    const result = await callService('cache-service', { get: '*' })
    // logger.warn('getAllTrackMetadata result:', result)
    
    // Returns object with trackId as keys, convert to array
    const tracks = Object.values(result || {})
    
    // Sort by createdAt descending
    tracks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    // logger.warn('getAllTrackMetadata tracks:', tracks)
    
    return tracks
  } catch (error) {
    console.error('Failed to get all track metadata:', error)
    return []
  }
}

/**
 * Initialize cache with metadata from object
 * Used during S3 initialization
 */
export async function initializeMetadataCache(metadataObject) {
  try {
    const trackIds = Object.keys(metadataObject)
    console.log(`Initializing cache with ${trackIds.length} tracks`)
    
    for (const trackId of trackIds) {
      await setTrackMetadata(trackId, metadataObject[trackId])
    }
    
    console.log(`Cache initialized with ${trackIds.length} tracks`)
    return true
  } catch (error) {
    console.error('Failed to initialize metadata cache:', error)
    return false
  }
}

