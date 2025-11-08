import { 
  registryServer, 
  createRoutes,
  createService,
  callService,
  overrideConsoleGlobally,
  HttpError,
  createCacheService,
  publishMessage,
  Logger,
  createAuthService,
  createStaticFileService,
  envConfig
} from 'micro-js'


import path from 'node:path'
import { fileURLToPath } from 'node:url'

// TODO remove
// import createAuthService from 'micro-js/auth-service'
// import createStaticFileService from 'micro-js/static-file-service'

// ---local services-------------------------------------------
import initializeAudioCleanupService from './services/audio-cleanup.js'
import getTrackMetadataFromCache from './services/tracks/get-track-metadata.js'
import getHealth from './services/health.js'
import {
  createTranscodedAudioUploadService,
  createWaveformUploadService
} from './services/internal-uploads.js'

import initializeLocalFileSystem from './services/s3/initialize.js'
import initializeS3BackupService from './services/s3/backup.js'

import getTrackList from './services/tracks/track-list.js'
import getTrackDetail from './services/tracks/track-detail.js'
import createTrackUploadService from './services/tracks/track-upload-service.js'
import updateTrack from './services/tracks/track-update.js'
import deleteTrack from './services/tracks/track-delete.js'

import createComment from './services/comments/comment-create.js'
import updateComment from './services/comments/comment-update.js'
import deleteComment from './services/comments/comment-delete.js'

// ---shared libraries----------------------------------------
import { ensureDataDirectories } from '../lib/utils.js'

// ---external services---------------------------------------
import initializeMusicMetadataProcessor from '../ffmpeg/music-meta.js'
import initializeAudioTranscodeService from '../ffmpeg/audio-transcode.js'
import initializeWaveformGenerator from '../ffmpeg/waveform-generator.js'


// ---setup system---------------------------------------------
overrideConsoleGlobally({ includeLogLineNumbers: true })
ensureDataDirectories()

const logger = new Logger({ logGroup: 'app' })
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const MICRO_REGISTRY_URL = envConfig.getRequired('MICRO_REGISTRY_URL')
const PORT = MICRO_REGISTRY_URL.split(':')[2]

async function startServer() {
  try {
    // start registry server first so services can register
    let registry = await registryServer()
    
    // create cache service for metadata (in-memory, no eviction)
    let services = [await createCacheService({
      cacheName: 'track-metadata',
      evictionInterval: 'None',
      expireTime: 60 * 60 * 1000
    })]
    
    // initialize local fs/cache from s3 before starting static file service
    await initializeLocalFileSystem()
    
    // wait for auth before we start upload service (requires it)
    services = services.concat(await Promise.all([
      createAuthService(),
      initializeAudioCleanupService(),
      initializeS3BackupService()
    ]))

    // omit these on prod, they should be deployed separately
    if (!process.env.ENVIRONMENT || process.env.ENVIRONMENT.toLowerCase().includes('local')) {
      logger.warn('non-prod environment; initializing ffmpeg services')
      services = services.concat(await Promise.all([
        initializeMusicMetadataProcessor(),
        initializeAudioTranscodeService(),
        initializeWaveformGenerator(),
      ]))
    } else logger.warn('prod environment; ffmpeg services should run separately')

    // register routes - will implcitly create services for each route
    services = services.concat(await createRoutes({
      '/health': getHealth,
      '/getTrackList': getTrackList,
      '/getTrackDetail': getTrackDetail,
      '/uploadTrack': await createTrackUploadService({
        serviceName: 'track-upload-service',
        useAuthService: 'auth-service',
        publishFileEvents: true,
        updateChannel: 'micro:file-updated',
        urlPathPrefix: '/audio/raw'
      }),
      // TODO do we need routes to call these? May need more integration tests
      '/uploadTranscodedAudio': await createTranscodedAudioUploadService(),
      '/uploadWaveform': await createWaveformUploadService(),
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
          // doesn't listen to the initial upload
          updateChannel: 'micro:file-updated',
          deleteChannel: 'micro:file-deleted',
        },
        fileMap: {
          '/': 'index.html',
          '/css/*': 'css',
          '/js/*': 'js',
          '/assets/*': 'assets',

          // Audio files - new directory structure matching URLs
          '/audio/raw/*': '../../../data/audio/raw',
          '/audio/optimized/*': '../../../data/audio/optimized',
          
          // Images - waveforms
          '/images/waveforms/*': '../../../data/images/waveforms',

          '/micro-js-html/*': '../node_modules/micro-js-html/src'
        }
      })
    }))

    // ALB healthcheck simulator
    // if (process.env.ENVIRONMENT?.includes('dev')) setInterval(async () => {
    //   try {
    //     let result =await callService('getHealth')
    //     logger.debug('healthcheck simulator passed: ', result)
    //   } catch (error) {
    //     logger.error('healthcheck simulator failed: ', error)
    //   }
    // }, 1000)
    
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
