import { 
  registryServer, 
  createRoutes,
  createService,
  callService,
  overrideConsoleGlobally,
  HttpError,
  createCacheService,
  publishMessage,
  Logger
} from 'micro-js'

import initializeMusicMetadataProcessor from './services/ffmpeg/music-meta.js'
import initializeAudioTranscodeService from './services/ffmpeg/audio-transcode.js'
import initializeAudioCleanupService from './services/audio-cleanup.js'
import initializeWaveformGenerator from './services/ffmpeg/waveform-generator.js'
import initializeLocalFileSystem from './services/s3-initialize.js'
import initializeS3BackupService from './services/s3-backup.js'
import createAuthService from 'micro-js/auth-service'
import createStaticFileService from 'micro-js/static-file-service'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ensureDataDirectories } from './lib/utils.js'

// Import all services
import getTrackList from './services/track-list.js'
import getTrackDetail from './services/track-detail.js'
import createTrackUploadService from './services/track-upload-service.js'
import updateTrack from './services/track-update.js'
import deleteTrack from './services/track-delete.js'
import createComment from './services/comment-create.js'
import updateComment from './services/comment-update.js'
import deleteComment from './services/comment-delete.js'
import getTrackMetadataFromCache from './services/audio-metadata.js'
import getHealth from './services/health.js'

const logger = new Logger({ logGroup: 'server' })

overrideConsoleGlobally({
  includeLogLineNumbers: true
})

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = process.env.MICRO_REGISTRY_URL.split(':')[2]

// Create data directories if they don't exist
ensureDataDirectories()

async function startServer() {
  try {
    // start registry server first so services can register
    let registry = await registryServer()
    
    // Create cache service for metadata (in-memory, no eviction)
    logger.info('creating metadata cache service...')
    const cacheService = await createCacheService({
      cacheName: 'track-metadata',
      evictionInterval: 'None', // No automatic eviction
      expireTime: 60 * 60 * 1000 // 1 hour
    })
    logger.info('metadata cache service created')
    
    // Initialize local filesystem from S3 FIRST (blocks static file service)
    // This will load metadata into the cache
    logger.info('initializing local filesystem from S3...')
    await initializeLocalFileSystem()
    logger.info('local filesystem initialization complete')
    
    // wait for auth before we start upload service (requires it)
    let services = [cacheService]
    services = services.concat(await Promise.all([
      createAuthService(),
      initializeAudioCleanupService(),
      initializeS3BackupService() // Start backup service to listen for file events
    ]))

    // omit these on prod, they should be deployed separately
    if (!process.env.ENVIRONMENT?.includes('prod')) {
      logger.warn('non-prod environment; initializing ffmpeg services')
      services = services.concat(await Promise.all([
        initializeMusicMetadataProcessor(),
        initializeAudioTranscodeService(),
        initializeWaveformGenerator(),
      ]))
    } else logger.warn('prod environment; ffmpeg services should run separately')

    // register routes - order matters
    services = services.concat(await createRoutes({
      '/health': getHealth,
      '/getTrackList': getTrackList,
      '/getTrackDetail': getTrackDetail,
      '/uploadTrack': await createTrackUploadService({
        useAuthService: 'auth-service',
        publishFileEvents: true,
        updateChannel: 'micro:file-uploaded'
      }),
      '/updateTrack': updateTrack,
      '/deleteTrack': deleteTrack,
      '/createComment': createComment,
      '/updateComment': updateComment,
      '/deleteComment': deleteComment,
      '/getTrackMetadata': getTrackMetadataFromCache,
      '/*': await createStaticFileService({
        rootDir: path.join(__dirname, 'public'),
        urlRoot: '/',
        autoRefresh: {
          mode: 'pubsub',
          // doesn't listen to the initial update
          updateChannel: 'micro:file-updated',
          deleteChannel: 'micro:file-deleted',
        },
        fileMap: {
          '/': 'index.html',
          '/css/*': 'css',
          '/js/*': 'js',
          '/assets/*': 'assets',
          '/api/audio/*': '../../data/uploads',
          '/api/waveforms/*': '../../data/waveforms',
          '/micro-js-html/*': '../../node_modules/micro-js-html/src'
        }
      })
    }))

    // ALB healthcheck simulator
    if (process.env.ENVIRONMENT?.includes('dev')) setInterval(async () => {
      try {
        let result =await callService('getHealth')
        logger.debug('healthcheck simulator passed: ', result)
      } catch (error) {
        logger.error('healthcheck simulator failed: ', error)
      }
    }, 1000)

    // logger.info('publishing test message to processUploadedAudio')
    // await publishMessage('processUploadedAudio', {
    //   messageId: 'test-123',
    //   trackId: 'test-123',
    //   originalFilePath: 'data/rawAudio/3minute-vox-plus-harmonies-03ae9dd2.mp3',
    //   transcodedFilePath: 'data/uploads/3minute-vox-plus-harmonies-03ae9dd2.webm',
    //   waveformFilePath: 'data/waveforms/3minute-vox-plus-harmonies-03ae9dd2.png',
    //   timestamp: new Date().toISOString()
    // })
    
    logger.info(`🔧 Registered services:\n  - ${services.map(service => service?.name).join('\n  - ')}`)
    logger.info(`SoundClone v0 server running on http://localhost:${PORT}`)

    // TODO shutdown helper in registry that calls terminate on all services then kills itself
    // services will need to be aware of any same host neighbors on same MICRO_SERVICE_URL, they will need to kill themselves too
    let isTerminating = false
    const gracefulShutdown = async (signal) => {
      if (isTerminating) return
      isTerminating = true

      logger.warn(`${signal} received, terminating server...`)

      await Promise.all(services.map(service => service?.terminate?.()))
      await registry.terminate()

      logger.info('server terminated gracefully')
      process.exit(0)
    }

    process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2'))
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
    process.on('SIGINT', () => gracefulShutdown('SIGINT'))
    
  } catch (error) {
    logger.error('failed to start server:', error)
    process.exit(1)
  }
}

startServer()
