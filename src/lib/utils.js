import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const rootDir = path.resolve(__dirname, '../../')

// Use DATA_DIR env var if provided, otherwise default to <root>/data
export const dataDir = process.env.DATA_DIR || path.join(rootDir, 'data')

// New structure matching URL paths
export const audioDir = path.join(dataDir, 'audio')
export const rawAudioDir = path.join(audioDir, 'raw')
export const optimizedAudioDir = path.join(audioDir, 'optimized')

export const imagesDir = path.join(dataDir, 'images')
export const waveformsDir = path.join(imagesDir, 'waveforms')

// Legacy export (deprecated)
export const uploadsDir = optimizedAudioDir

export function ensureDataDirectories() {
  const directories = [
    dataDir,
    audioDir,
    rawAudioDir,
    optimizedAudioDir,
    imagesDir,
    waveformsDir
  ]
  
  for (const dir of directories) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  }
}

