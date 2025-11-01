import { 
  registryServer, 
  createRoutes,
  createService,
  callService,
  overrideConsoleGlobally,
  HttpError
} from 'micro-js'

import createPubsubService from 'micro-js/pubsub-service'
import initializeMusicMetadataProcessor from './services/music-meta.js'
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
import audioStreamService from './services/audio-stream.js'
import audioMetadataService from './services/audio-metadata.js'
import getHealth from './services/health.js'

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
    console.log('Starting SoundClone v0 with micro-js...')
    
    let registry = await registryServer()
    console.log(`Registry server running on port ${PORT}`)
    
    const publicDir = path.join(__dirname, 'public')
    
    let authService = await createAuthService()
    let pubsubService = await createPubsubService()    
    const trackUploadService = await createTrackUploadService({
      useAuthService: authService,
      pubsubService
    })

    console.log('trackUploadService', trackUploadService.name)
    
    await initializeMusicMetadataProcessor(pubsubService)


    // Register all API routes - order matters! More specific routes first
    console.log('🔧 Registering routes...')
    let services = await createRoutes({
      '/health': function health() { return 'OK' },
      '/api/audio/*': audioStreamService,  // Must be before static file service
      '/getTrackList': getTrackList,
      '/getTrackDetail': getTrackDetail,
      '/uploadTrack': trackUploadService,
      '/updateTrack': updateTrack,
      '/deleteTrack': deleteTrack,
      '/createComment': createComment,
      '/updateComment': updateComment,
      '/deleteComment': deleteComment,
      '/getAudioMetadata': audioMetadataService,
      '/getHealth': getHealth,
      '/*': await createStaticFileService({
        rootDir: publicDir,
        urlRoot: '/',
        fileMap: {
          '/': 'index.html',
          '/css/*': 'css',
          '/js/*': 'js',
          '/assets/*': 'assets',
          '/micro-js-html/*': '../../node_modules/micro-js-html/src'
        }
      })
    })
    
    console.log('🔧 Routes registered successfully')
    console.log('🔧 Registered services:', Object.keys(services))
    console.log(`SoundClone v0 server running on http://localhost:${PORT}`)
    console.log(`API health check: http://localhost:${PORT}/api/health`)
    console.log(`🎵 Audio streaming: http://localhost:${PORT}/api/audio/test-track.wav`)

    // TODO shutdown helper in registry that calls terminate on all services then kills itself
    // services will need to be aware of any same host neighbors on same MICRO_SERVICE_URL, they will need to kill themselves too
    let isTerminating = false
    const gracefulShutdown = async (signal) => {
      if (isTerminating) return
      isTerminating = true

      console.log(`${signal} received, terminating server...`)
      await Promise.all(services.map(service => service?.terminate()))
      await registry.terminate()
      console.log('Server terminated')
      process.exit(0)
    }

    process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2'))
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
    process.on('SIGINT', () => gracefulShutdown('SIGINT'))
    
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

startServer()
