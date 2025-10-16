import { 
  registryServer, 
  createRoutes,
  overrideConsoleGlobally,
  HttpError
} from 'micro-js'
import createStaticFileService from 'micro-js/static-file-service'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ensureDataDirectories } from './lib/utils.js'

// Import all services
import getTrackList from './services/track-list.js'
import getTrackDetail from './services/track-detail.js'
import uploadTrack from './services/track-upload.js'
import updateTrack from './services/track-update.js'
import deleteTrack from './services/track-delete.js'
import createComment from './services/comment-create.js'
import updateComment from './services/comment-update.js'
import deleteComment from './services/comment-delete.js'
import audioStreamService from './services/audio-stream.js'
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
    
    // Create static file service for serving public files
    const publicDir = path.join(__dirname, 'public')
    const nodeModulesDir = path.join(process.cwd(), 'node_modules')
    
    let staticFileService = await createStaticFileService({
      rootDir: publicDir,
      fileMap: {
        '/': 'index.html',
        '/css/*': 'css/*',
        '/js/*': 'js/*',
        // TODO should discover these dynamically
        '/js/views/*': 'js/views/*',
        '/js/components/*': 'js/components/*'
      }
    }, async (url) => {
      // Custom resolver for micro-js-html modules
      if (url.startsWith('/micro-js-html/')) {
        const modulePath = path.join(nodeModulesDir, url)
        const fs = await import('node:fs')
        if (fs.existsSync(modulePath)) {
          return fs.readFileSync(modulePath, 'utf-8')
        }
      }
      
      return new HttpError(404, 'File not found')
    })
    
    // Register all API routes
    let services = await createRoutes({
      '/getTrackList': getTrackList,
      '/getTrackDetail': getTrackDetail,
      '/uploadTrack': uploadTrack,
      '/updateTrack': updateTrack,
      '/deleteTrack': deleteTrack,
      '/createComment': createComment,
      '/updateComment': updateComment,
      '/deleteComment': deleteComment,
      '/api/audio/*': audioStreamService,
      '/getHealth': getHealth,
      '/*': 'static-file-service',
    })
    
    console.log(`SoundClone v0 server running on http://localhost:${PORT}`)
    console.log(`API health check: http://localhost:${PORT}/api/health`)

    // TODO shutdown helper in registry that calls terminate on all services then kills itself
    // services will need to be aware of any same host neighbors on same MICRO_SERVICE_URL, they will need to kill themselves too
    let isTerminating = false
    const gracefulShutdown = async (signal) => {
      if (isTerminating) return
      isTerminating = true

      console.log(`${signal} received, terminating server...`)
      await staticFileService.terminate()
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
