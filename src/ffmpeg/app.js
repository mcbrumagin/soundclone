import { registryServer, createService, callService } from 'micro-js'
import initializeMusicMetadataProcessor from './music-meta.js'
import initializeAudioTranscodeService from './audio-transcode.js'
import initializeWaveformGenerator from './waveform-generator.js'

async function main() {

  let registry = await registryServer()
  let metadataProcessor = await initializeMusicMetadataProcessor()
  let audioTranscodeService = await initializeAudioTranscodeService()
  let waveformGenerator = await initializeWaveformGenerator()

  let isTerminating = false
  const gracefulShutdown = async (signal) => {
    if (isTerminating) return
    isTerminating = true

    console.log(`${signal} received, terminating service...`)

    await metadataProcessor.terminate()
    await audioTranscodeService.terminate()
    await waveformGenerator.terminate()
    await registry.terminate()
    
    process.exit(0)
  }

  process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2'))
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
  process.on('SIGINT', () => gracefulShutdown('SIGINT'))
}

main().catch(console.error)