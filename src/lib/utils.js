import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const rootDir = path.resolve(__dirname, '../../')
export const dataDir = path.join(rootDir, 'data')
export const uploadsDir = path.join(dataDir, 'uploads')
export const metadataDir = path.join(dataDir, 'metadata')

export function ensureDataDirectories() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir)
  }
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir)
  }
  if (!fs.existsSync(metadataDir)) {
    fs.mkdirSync(metadataDir)
  }
}

