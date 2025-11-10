import path from 'node:path'
import { fileURLToPath } from 'node:url'


// ---micro core-----------------------------------------------------
import {
  registryServer,
  createRoutes,
  createService,
  callService,
  publishMessage,
  HttpError,
  createCacheService,
  createAuthService,
  createStaticFileService,
  envConfig,
  overrideConsoleGlobally,
  Logger,
} from 'micro-js'

// ---local services-------------------------------------------------
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

// ---shared libraries-----------------------------------------------
import { ensureDataDirectories } from '../lib/utils.js'

// ---external services----------------------------------------------
async function importAtRunTime() {
  return [
    (await import('../ffmpeg/music-meta.js')).default,
    (await import('../ffmpeg/audio-transcode.js')).default,
    (await import('../ffmpeg/waveform-generator.js')).default
  ]
}

// ---setup system---------------------------------------------------
overrideConsoleGlobally({ includeLogLineNumbers: true })
ensureDataDirectories()

const logger = new Logger({ logGroup: 'app' })
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)


const MICRO_REGISTRY_URL = envConfig.getRequired('MICRO_REGISTRY_URL')
const PORT = MICRO_REGISTRY_URL.split(':')[2]
const NODE_MODULES_DIR = envConfig.get('NODE_MODULES_DIR', '../node_modules')

const ENVIRONMENT = envConfig.get('ENVIRONMENT', 'dev').toLowerCase()
const isLocal = ENVIRONMENT.includes('local')
const isDev = ENVIRONMENT.includes('dev')
const isProd = ENVIRONMENT.includes('prod')


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
    if (isLocal) {
      logger.warn('non-prod environment; initializing ffmpeg services')
      services = services.concat(await Promise.all(await importAtRunTime()))
    } else logger.warn('prod environment; ffmpeg services should run separately')

    // internal upload services don't need routes
    // allows the ffmpeg container to pass files back to static-file-service
    services = services.concat([
      await createTranscodedAudioUploadService(),
      await createWaveformUploadService()
    ])

    let routeMap = {
      '/health': getHealth,
      '/getTrackList': getTrackList,
      '/getTrackDetail': getTrackDetail,
      '/updateTrack': updateTrack,
      '/deleteTrack': deleteTrack,
      '/createComment': createComment,
      '/updateComment': updateComment,
      '/deleteComment': deleteComment,
      '/getTrackMetadata': getTrackMetadataFromCache,
      '/uploadTrack': await createTrackUploadService({
        serviceName: 'track-upload-service',
        useAuthService: 'auth-service',
        publishFileEvents: true,
        updateChannel: 'micro:file-updated',
        urlPathPrefix: '/audio/raw'
      }),
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
          '/audio/raw/*': '../../../data/audio/raw',
          '/audio/optimized/*': '../../../data/audio/optimized',
          '/images/waveforms/*': '../../../data/images/waveforms',
          '/micro-js-html/*': path.join(NODE_MODULES_DIR, 'micro-js-html/src')
        }
      })
    }

    if (isLocal || isDev) {
      routeMap['/debug'] = async function debug(payload) {
        let response = await fetch(MICRO_REGISTRY_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'micro-command': 'service-lookup',
            'micro-service-name': '*'
          },
          body: JSON.stringify(payload)
        })
        if (!response.ok) {
          throw new Error(`Service call failed: ${response.status} ${response.statusText}`)
        }
        return await response.json()
      }
    }

    // register routes - will implcitly create services for each route
    services = services.concat(await createRoutes(routeMap))
    
    logger.info(`Registered services:\n  - ${services.map(service => service?.name).join('\n  - ')}`)
    logger.info(`SoundClone v0 server running on http://localhost:${PORT}`)

    // TODO shutdown helper in registry that calls terminate on all services then kills itself
    // each node will need a node-serivce for health, service cache updates, and termination
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
