# Library Helpers

Common utility functions used throughout the SoundClone services.

## Modules

### `async-helpers.js` - Async Utilities

Helpers for async operations, timing, and retries.

#### Functions

**`sleep(ms)`**
```javascript
await sleep(1000) // Wait 1 second
```

**`waitFor(timeoutMs, intervalMs, condition, errorMessage)`**
```javascript
// Wait for file to exist, checking every second for 30 seconds
await waitFor(30000, 1000, async () => {
  return await fileExists('/path/to/file')
}, 'File not found')
```

**`retry(fn, options)`**
```javascript
// Retry with exponential backoff
const result = await retry(
  () => fetchDataFromAPI(),
  {
    maxAttempts: 3,
    initialDelay: 1000,
    backoffMultiplier: 2,
    shouldRetry: (err) => err.code === 'ETIMEDOUT'
  }
)
```

**`withTimeout(fn, timeoutMs, errorMessage)`**
```javascript
// Fail if operation takes longer than 5 seconds
const result = await withTimeout(
  () => longRunningOperation(),
  5000,
  'Operation timed out'
)
```

**`batchExecute(items, fn, batchSize)`**
```javascript
// Process 100 items, 5 at a time in parallel
const results = await batchExecute(
  items,
  async (item) => processItem(item),
  5 // concurrency limit
)
```

---

### `fs-helpers.js` - Filesystem Utilities

Safe filesystem operations with error handling.

#### Functions

**`fileExists(filePath)`**
```javascript
if (await fileExists('/path/to/file')) {
  // File exists
}
```

**`verifyFile(filePath, description)`**
```javascript
const result = await verifyFile('/path/to/file', 'Audio file')
// Returns: { exists: boolean, size: number, error?: string }
```

**`ensureDir(dirPath)`**
```javascript
// Create directory if it doesn't exist (recursive)
await ensureDir('/path/to/nested/directory')
```

**`safeDelete(filePath, options)`**
```javascript
// Delete file, doesn't throw if file doesn't exist
const deleted = await safeDelete('/path/to/file', { 
  logNotFound: true 
})
// Returns: true if deleted, false if didn't exist
```

**`deleteFiles(filePaths, onDelete)`**
```javascript
// Delete multiple files, continue on errors
const result = await deleteFiles(
  ['/file1', '/file2', '/file3'],
  async (filePath) => {
    console.log(`Deleted: ${filePath}`)
    await publishDeleteEvent(filePath)
  }
)
// Returns: { deleted: number, failed: Array }
```

**`getFileSize(filePath)`**
```javascript
const size = await getFileSize('/path/to/file')
// Returns: size in bytes, 0 if doesn't exist
```

**`safeCopy(src, dest, options)`**
```javascript
// Copy file with error handling
await safeCopy('/source/file', '/dest/file', {
  overwrite: true
})
```

**`readJSON(filePath, defaultValue)`**
```javascript
// Read JSON file, return default if doesn't exist
const config = await readJSON('/config.json', {})
```

**`writeJSON(filePath, data, indent)`**
```javascript
// Write JSON with pretty printing
await writeJSON('/config.json', { setting: 'value' }, 2)
```

**`findFiles(dirPath, predicate, options)`**
```javascript
// Find all .mp3 files recursively
const mp3Files = await findFiles(
  '/audio',
  (name) => name.endsWith('.mp3'),
  { recursive: true }
)
```

---

### `utils.js` - Application Utilities

Core application utilities (directories, etc).

#### Constants

```javascript
export const rootDir = path.resolve(__dirname, '../../')
export const dataDir = path.join(rootDir, 'data')
export const rawAudioDir = path.join(dataDir, 'rawAudio')
export const uploadsDir = path.join(dataDir, 'uploads')
export const metadataDir = path.join(dataDir, 'metadata')
export const waveformsDir = path.join(dataDir, 'waveforms')
```

#### Functions

**`ensureDataDirectories()`**
```javascript
// Create all data directories if they don't exist
ensureDataDirectories()
```

---

### `metadata-cache.js` - Metadata Cache Operations

Cache-based metadata management (prevents race conditions).

#### Functions

**`getTrackMetadata(trackId)`**
```javascript
const track = await getTrackMetadata('track-123')
```

**`setTrackMetadata(trackId, metadata)`**
```javascript
await setTrackMetadata('track-123', {
  title: 'My Track',
  duration: 180,
  // ...
})
```

**`mergeAndUpdateTrackMetadata(trackId, updates)`** ⭐ **Atomic**
```javascript
// Atomic merge - prevents race conditions
await mergeAndUpdateTrackMetadata('track-123', {
  processingStatus: 'completed',
  duration: 180
})
```

**`deleteTrackMetadata(trackId)`**
```javascript
await deleteTrackMetadata('track-123')
```

**`getAllTrackMetadata()`**
```javascript
// Get all tracks, sorted by createdAt descending
const tracks = await getAllTrackMetadata()
```

---

## Usage Examples

### Service with Logging and File Operations

```javascript
import Logger from 'micro-js/logger'
import { verifyFile, safeDelete } from '../lib/fs-helpers.js'
import { waitFor } from '../lib/async-helpers.js'

const logger = new Logger({ logGroup: 'my-service' })

async function processFile(filePath) {
  // Wait for file to be ready
  await waitFor(30000, 1000, async () => {
    const result = await verifyFile(filePath, 'Input file')
    return result.exists && result.size > 0
  }, 'File not ready')
  
  // Process...
  logger.info('Processing complete')
  
  // Clean up
  await safeDelete(filePath)
}
```

### Batch Processing with Progress

```javascript
import Logger from 'micro-js/logger'
import { createProgressLogger } from '../lib/logger-helpers.js'
import { batchExecute } from '../lib/async-helpers.js'
import { findFiles } from '../lib/fs-helpers.js'

const logger = new Logger({ logGroup: 'batch-processor' })

async function processAllFiles() {
  const files = await findFiles('/data', (name) => name.endsWith('.json'))
  const progress = createProgressLogger(logger, 'Processing files', files.length)
  
  await batchExecute(
    files,
    async (file) => {
      await processFile(file)
      progress.increment()
    },
    5 // Process 5 at a time
  )
  
  progress.complete()
}
```

### Retry with Backoff

```javascript
import { retry } from '../lib/async-helpers.js'

async function uploadToS3(file) {
  return retry(
    () => s3Client.send(new PutObjectCommand({ /* ... */ })),
    {
      maxAttempts: 3,
      initialDelay: 1000,
      shouldRetry: (err) => err.code === 'NetworkError'
    }
  )
}
```

## Migration from Old Code

### Before
```javascript
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

async function waitFor(timeoutMs, intervalMs, condition, errorMessage) {
  // ... copy-pasted implementation ...
}

try {
  await fs.access(filePath)
  await fs.unlink(filePath)
} catch (err) {
  if (err.code !== 'ENOENT') throw err
}
```

### After
```javascript
import { sleep, waitFor } from '../lib/async-helpers.js'
import { safeDelete } from '../lib/fs-helpers.js'

await safeDelete(filePath)
```

## Benefits

1. **No Duplication**: Single source of truth for common operations
2. **Better Error Handling**: Consistent error handling patterns
3. **Cleaner Code**: Less boilerplate in services
4. **Easier Testing**: Mock helper modules instead of duplicated code
5. **Type Safety**: Consistent function signatures
6. **Documentation**: All helpers documented in one place

