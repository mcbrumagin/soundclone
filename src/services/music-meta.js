import { parseFile } from 'music-metadata'
import { inspect } from 'node:util'
import path from 'node:path'
import fs from 'node:fs/promises'

import Logger from 'micro-js/logger'

const logger = new Logger({ logGroup: 'music-meta' })

const metadataDir = path.join(process.cwd(), 'data','metadata')
const uploadsDir = path.join(process.cwd(), 'data', 'uploads')

async function writeMusicMetadataToFile(metadata, filePath) {
  return await fs.writeFile(filePath, JSON.stringify(metadata, null, 2))
}

function transformMusicMetadata(metadata) {
  return {
    title: metadata.title,
    artist: metadata.artist,
    album: metadata.album,
    year: metadata.year,
    genre: metadata.genre
  }
}

async function processMusicMetadata(fileName) {
  try {

    const filePath = path.join(uploadsDir, fileName)
    const metadata = await parseFile(filePath)
    logger.debug(inspect(metadata, { showHidden: false, depth: null }))
    logger.info(`Metadata parsed successfully for file: ${filePath}`)

    const transformedMetadata = transformMusicMetadata(metadata)
    const metadataFilePath = path.join(metadataDir, `${fileName}.json`)
    await writeMusicMetadataToFile(transformedMetadata, metadataFilePath)
    logger.info(`Metadata written to file: ${metadataFilePath}`)

  } catch (error) {
    logger.error(`Error parsing metadata for file: ${filePath}: ${error.message}`)
  }
}

export default async function initializeMusicMetadataProcessor(pubsubService) {
  if (!(pubsubService?.subscribe)) throw new Error('Pubsub service is required')
  pubsubService.subscribe('processMusicMetadata', async (message) => {
  logger.debug(`received message to process music metadata:`, message)
    await processMusicMetadata(message.fileName)
  })
}
