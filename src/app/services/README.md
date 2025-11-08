# SoundClone Services

## Core Services

### Track Services
- **track-list.js** - List all tracks
- **track-detail.js** - Get track details
- **track-upload-service.js** - Handle track uploads (multipart)
- **track-update.js** - Update track metadata
- **track-delete.js** - Delete tracks and associated files

### Comment Services
- **comment-create.js** - Add comments to tracks
- **comment-update.js** - Edit comments
- **comment-delete.js** - Delete comments

### Audio Processing Services (FFmpeg)
Located in `ffmpeg/`:
- **music-meta.js** - Extract audio metadata (duration, format, etc.)
- **audio-transcode.js** - Transcode audio to Opus/WebM
- **waveform-generator.js** - Generate waveform visualizations

### Utility Services
- **audio-cleanup.js** - Clean up temporary files after processing
- **audio-metadata.js** - Provide audio metadata via API
- **audio-stream.js** - Stream audio with range request support
- **health.js** - Health check endpoint

### S3 Backup & Sync Services
- **s3-initialize.js** - Initialize local filesystem from S3 on startup
- **s3-backup.js** - Continuous backup service listening to file events

## Service Architecture

### Event Flow

```
Upload → audio-metadata → audio-transcode → waveform-generator → audio-cleanup
                ↓              ↓                    ↓
             metadata       uploads             waveforms
                ↓              ↓                    ↓
          file-updated   file-updated         file-updated
                ↓              ↓                    ↓
              S3 Backup Service (automatic upload to S3)
```

### Startup Flow

```
1. Registry Server starts
2. S3 Initialize Service runs (blocks until complete)
   - Downloads all files from S3
   - Syncs metadata, rawAudio, uploads, waveforms
3. S3 Initialize terminates
4. Auth Service starts
5. S3 Backup Service starts (listens for events)
6. Audio Cleanup Service starts
7. FFmpeg Services start (non-prod only)
8. Static File Service starts
9. Route handlers registered
```

## File Events

Services communicate via pub/sub events:

### Published Events
- `micro:file-uploaded` - New file uploaded
- `micro:file-updated` - File created or modified
- `micro:file-deleted` - File deleted
- `audioMetadataComplete` - Metadata extraction complete
- `audioTranscodeComplete` - Transcoding complete
- `waveformComplete` - Waveform generation complete
- `audioProcessingFailed` - Processing failed

### Subscribed Events
- **s3-backup.js** listens to:
  - `micro:file-updated` → uploads file to S3
  - `micro:file-deleted` → deletes file from S3

- **audio-cleanup.js** listens to:
  - `micro:file-uploaded` → starts processing pipeline

- **music-meta.js** listens to:
  - `micro:file-uploaded` → extracts metadata

- **audio-transcode.js** listens to:
  - `audioMetadataComplete` → transcodes audio

- **waveform-generator.js** listens to:
  - `audioTranscodeComplete` → generates waveform

## Data Directories

```
data/
├── metadata/      # Track metadata JSON files
├── rawAudio/      # Original uploaded files
├── uploads/       # Transcoded audio (Opus/WebM)
└── waveforms/     # Waveform PNG images
```

## Adding a New Service

1. Create service file in `src/services/`
2. Export default async function
3. Import in `src/server.js`
4. Add to appropriate startup phase
5. Subscribe to events if needed
6. Publish events for other services

### Example Service Template

```javascript
import { subscribe, publishMessage } from 'micro-js'

export default async function initializeMyService() {
  console.log('Initializing my service')
  
  // Subscribe to events
  const unsubscribe = await subscribe('some-event', async (message) => {
    // Handle event
    console.log('Received event:', message)
    
    // Do work...
    
    // Publish completion
    await publishMessage('my-service-complete', {
      success: true
    })
  })
  
  return {
    name: 'my-service',
    terminate: async () => {
      console.log('Terminating my service')
      await unsubscribe()
    }
  }
}
```

