import { getTrackMetadata } from '../lib/metadata-cache.js'
import { next, HttpError } from 'micro-js'
import Logger from 'micro-js/logger'

const logger = new Logger({ logGroup: 'audio-metadata' })

export default async function getTrackMetadataFromCache(payload, request, response) {
  try {
    const { trackId } = payload || {}
    logger.info('getting track metadata from cache', { trackId })

    let metadata = await getTrackMetadata(trackId)
    if (!metadata) {
      throw new HttpError(404, 'Metadata not found for track ' + trackId)
    }

    return next({
      success: true,
      metadata
    })
  } catch (err) {
    logger.error('error getting track metadata from cache', err)
    throw err
  }
}
