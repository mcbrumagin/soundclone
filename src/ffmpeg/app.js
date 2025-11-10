import initializeMusicMetadataProcessor from './music-meta.js'
import initializeAudioTranscodeService from './audio-transcode.js'
import initializeWaveformGenerator from './waveform-generator.js'
import Logger from 'micro-js/logger'

const logger = new Logger({ logGroup: 'ffmpeg-service' })

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

  // Wait for registry to be available (for dev/prod deployments)
  const registryUrl = process.env.MICRO_REGISTRY_URL
  if (registryUrl) {
    await waitForRegistry(registryUrl)
  } else {
    logger.warn('No MICRO_REGISTRY_URL set, skipping registry health check')
  }

  // Initialize services - they will register with the main registry
  logger.info('Initializing FFmpeg services...')
  const metadataProcessor = await initializeMusicMetadataProcessor()
  const audioTranscodeService = await initializeAudioTranscodeService()
  const waveformGenerator = await initializeWaveformGenerator()

  logger.info('✅ All FFmpeg services initialized and registered')

  let isTerminating = false
  const gracefulShutdown = async (signal) => {
    if (isTerminating) return
    isTerminating = true

    logger.info(`${signal} received, terminating services...`)

    await metadataProcessor.terminate()
    await audioTranscodeService.terminate()
    await waveformGenerator.terminate()
    
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