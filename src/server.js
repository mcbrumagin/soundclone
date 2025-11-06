import { 
  registryServer, 
  createRoutes,
  createService,
  callService,
  overrideConsoleGlobally,
  HttpError
} from 'micro-js'

import initializeMusicMetadataProcessor from './services/ffmpeg/music-meta.js'
import initializeAudioTranscodeService from './services/ffmpeg/audio-transcode.js'
import initializeAudioCleanupService from './services/audio-cleanup.js'
import initializeWaveformGenerator from './services/ffmpeg/waveform-generator.js'
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
    // start registry server first so services can register
    let registry = await registryServer()
    
    // wait for auth before we start upload service (requires it)
    let services = await Promise.all([
      createAuthService(),
      initializeAudioCleanupService()
    ])

    if (!process.env.ENVIRONMENT?.includes('prod')) {
      console.warn('non-prod environment; initializing ffmpeg services')
      services = services.concat(await Promise.all([
        initializeMusicMetadataProcessor(),
        initializeAudioTranscodeService(),
        initializeWaveformGenerator(),
      ]))
    } else console.warn('prod environment; ffmpeg services should run separately')

    // register routes - order matters
    services = services.concat(await createRoutes({
      '/health': function health() { return 'OK' },
      // '/api/audio/*': audioStreamService,
      '/getTrackList': getTrackList,
      '/getTrackDetail': getTrackDetail,
      '/uploadTrack': await createTrackUploadService({
        useAuthService: 'auth-service',
        publishFileEvents: true // publishes to channel "micro:file-uploaded"
      }),
      '/updateTrack': updateTrack,
      '/deleteTrack': deleteTrack,
      '/createComment': createComment,
      '/updateComment': updateComment,
      '/deleteComment': deleteComment,
      '/getAudioMetadata': audioMetadataService,
      '/getHealth': getHealth,
      '/*': await createStaticFileService({
        rootDir: path.join(__dirname, 'public'),
        urlRoot: '/',
        autoRefresh: { mode: 'pubsub' }, // listens to channel "micro:file-uploaded"
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
    
    console.log(`🔧 Registered services:\n  - ${services.map(service => service?.name).join('\n  - ')}`)
    console.log(`SoundClone v0 server running on http://localhost:${PORT}`)

    // TODO shutdown helper in registry that calls terminate on all services then kills itself
    // services will need to be aware of any same host neighbors on same MICRO_SERVICE_URL, they will need to kill themselves too
    let isTerminating = false
    const gracefulShutdown = async (signal) => {
      if (isTerminating) return
      isTerminating = true

      console.log(`${signal} received, terminating server...`)

      await Promise.all(services.map(service => service?.terminate?.()))
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
