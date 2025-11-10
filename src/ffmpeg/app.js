import http from 'http'
import initializeMusicMetadataProcessor from './music-meta.js'
import initializeAudioTranscodeService from './audio-transcode.js'
import initializeWaveformGenerator from './waveform-generator.js'
import Logger from 'micro-js/logger'

const logger = new Logger({ logGroup: 'ffmpeg-service' })

// Service state for health checks
const serviceState = {
  status: 'starting',
  services: {},
  startedAt: new Date().toISOString()
}

/**
 * Create a simple health check server
 */
function createHealthServer(port = 11000) {
  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        status: serviceState.status,
        services: serviceState.services,
        startedAt: serviceState.startedAt,
        uptime: Math.floor((Date.now() - new Date(serviceState.startedAt).getTime()) / 1000)
      }, null, 2))
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Not found' }))
    }
  })

  server.listen(port, () => {
    logger.info(`✓ Health server listening on port ${port}`)
  })

  return server
}

/**
 * Wait for registry to be available (for dev/prod deployments)
 * In ECS, containers start independently, so we need to wait for the main service
 */
async function waitForRegistry(registryUrl, maxAttempts = 60, intervalMs = 1000) {
  const environment = process.env.ENVIRONMENT || 'local'
  
  // Skip wait for local development (docker-run.sh handles it)
  if (environment.toLowerCase().includes('local')) {
    logger.info('Local environment detected, skipping registry wait')
    return true
  }

  logger.info(`${environment} environment detected, waiting for registry to be available...`)
  logger.info(`Registry URL: ${registryUrl}`)
  
  // Extract base URL for health check
  const healthUrl = `${registryUrl}/health`
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(healthUrl, { 
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5 second timeout per request
      })
      
      if (response.ok) {
        logger.info(`✓ Registry is healthy after ${attempt} attempt(s)`)
        return true
      }
      
      logger.debug(`Attempt ${attempt}/${maxAttempts}: Registry returned status ${response.status}`)
    } catch (error) {
      logger.debug(`Attempt ${attempt}/${maxAttempts}: ${error.message}`)
    }
    
    if (attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, intervalMs))
    }
  }
  
  logger.warn(`⚠️  Registry health check timed out after ${maxAttempts} attempts, proceeding anyway`)
  return false
}

async function main() {
  logger.info('Starting FFmpeg service...')
  logger.info(`Registry URL: ${process.env.MICRO_REGISTRY_URL}`)
  logger.info(`Service URL: ${process.env.MICRO_SERVICE_URL}`)
  logger.info(`Environment: ${process.env.ENVIRONMENT || 'local'}`)

  // Start health server immediately (before service initialization)
  const healthPort = 11000
  const healthServer = createHealthServer(healthPort)
  serviceState.status = 'waiting_for_registry'

  // Wait for registry to be available (for dev/prod deployments)
  const registryUrl = process.env.MICRO_REGISTRY_URL
  if (registryUrl) {
    await waitForRegistry(registryUrl)
  } else {
    logger.warn('No MICRO_REGISTRY_URL set, skipping registry health check')
  }

  // Initialize services - they will register with the main registry
  serviceState.status = 'initializing_services'
  logger.info('Initializing FFmpeg services...')
  const metadataProcessor = await initializeMusicMetadataProcessor()
  const audioTranscodeService = await initializeAudioTranscodeService()
  const waveformGenerator = await initializeWaveformGenerator()

  // Update service state with locations
  serviceState.status = 'running'
  serviceState.services = {
    metadataProcessor: metadataProcessor?.location || 'unknown',
    audioTranscodeService: audioTranscodeService?.location || 'unknown',
    waveformGenerator: waveformGenerator?.location || 'unknown'
  }

  logger.info('✅ All FFmpeg services initialized and registered')
  logger.info(`Service locations:`)
  Object.entries(serviceState.services).forEach(([name, location]) => {
    logger.info(`  - ${name}: ${location}`)
  })

  let isTerminating = false
  const gracefulShutdown = async (signal) => {
    if (isTerminating) return
    isTerminating = true

    serviceState.status = 'terminating'
    logger.info(`${signal} received, terminating services...`)

    await metadataProcessor.terminate()
    await audioTranscodeService.terminate()
    await waveformGenerator.terminate()
    
    // Close health server
    if (healthServer) {
      await new Promise((resolve) => healthServer.close(resolve))
      logger.info('✓ Health server closed')
    }
    
    logger.info('✅ All services terminated')
    process.exit(0)
  }

  process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2'))
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
  process.on('SIGINT', () => gracefulShutdown('SIGINT'))
}

main().catch((error) => {
  logger.error('Failed to start FFmpeg service:', error)
  process.exit(1)
})