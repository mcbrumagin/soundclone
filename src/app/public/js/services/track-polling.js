import { getTracks } from '../api.js'

class TrackPollingService {
  constructor() {
    this.minInterval = 2000 // 2 seconds - fast check after upload
    this.maxInterval = 60000 // 60 seconds - max backoff
    this.currentInterval = this.minInterval
    this.backoffMultiplier = 1.5
    this.timeoutId = null
    this.isPolling = false
    
    // Track uploads that are pending processing
    // Map of trackId -> { uploadedAt: timestamp }
    this.pendingUploads = new Map()
    
    // Track previous waveform states to detect when they become available
    // Map of trackId -> { isTranscoded: boolean, isWaveformGenerated: boolean }
    this.previousStates = new Map()
    
    this.isSuspended = false
  }

  start(onNewTracks) {
    if (this.isPolling) return
    
    this.isPolling = true
    this.onNewTracks = onNewTracks
    this.scheduleNextPoll()
    console.log('Track polling started')
  }

  stop() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
    this.isPolling = false
    console.log('Track polling stopped')
  }

  resetBackoff() {
    console.log('Resetting polling backoff to fast interval')
    this.currentInterval = this.minInterval
  }

  scheduleNextPoll() {
    if (!this.isPolling) return
    
    // Don't schedule if suspended
    if (this.isSuspended) {
      console.log('Polling suspended, not scheduling next poll')
      return
    }

    this.timeoutId = setTimeout(async () => {
      await this.poll()
      this.scheduleNextPoll()
    }, this.currentInterval)

    console.log(`Next poll scheduled in ${this.currentInterval}ms`)
  }

  async poll() {
    try {
      const tracks = await getTracks()
      
      // Check status of pending uploads and track state changes
      let allPendingComplete = true
      
      for (const track of tracks) {
        const trackId = track.id
        const previousState = this.previousStates.get(trackId)
        const currentState = {
          isTranscoded: track.isTranscoded || false,
          isWaveformGenerated: track.isWaveformGenerated || false
        }
        
        // Detect when transcode completes
        if (previousState && !previousState.isTranscoded && currentState.isTranscoded) {
          console.log(`✓ Transcoding complete for track ${trackId}`)
          if (this.onNewTracks) {
            this.onNewTracks(tracks)
          }
          // this.isTranscodingComplete = true // TODO?
        }
        
        // Detect when waveform generation completes
        if (previousState && !previousState.isWaveformGenerated && currentState.isWaveformGenerated) {
          console.log(`✓ Waveform generated for track ${trackId}`)
          if (this.onNewTracks) {
            this.onNewTracks(tracks)
          }
        }
        
        // Update previous state
        this.previousStates.set(trackId, currentState)
        
        // Check if this track is pending processing
        const pendingStatus = this.pendingUploads.get(trackId)
        if (pendingStatus) {
          // Track is complete if both transcode and waveform are done (or timeout after 5 minutes)
          const isComplete = (currentState.isTranscoded && currentState.isWaveformGenerated) || 
            (Date.now() - pendingStatus.uploadedAt > 5 * 60 * 1000)
          
          if (!isComplete) {
            allPendingComplete = false
            // Log progress
            const status = []
            if (!currentState.isTranscoded) status.push('transcoding')
            if (!currentState.isWaveformGenerated) status.push('waveform')
            console.log(`⏳ Track ${trackId} processing: ${status.join(', ')}`)
          } else if (isComplete) {
            console.log(`✓ Processing complete for track ${trackId}`)
            // Remove from pending if fully complete
            this.pendingUploads.delete(trackId)
          }
        }
      }
      
      // If all pending uploads are complete, suspend polling
      if (this.pendingUploads.size > 0 && allPendingComplete) {
        console.log('All pending uploads complete, suspending polling')
        this.isSuspended = true
        this.pendingUploads.clear()
      }
      
      // Increase interval (exponential backoff) if not actively processing uploads
      if (this.pendingUploads.size === 0) {
        this.currentInterval = Math.min(
          this.currentInterval * this.backoffMultiplier,
          this.maxInterval
        )
      } else {
        // Keep fast polling while processing
        console.log(`Pending uploads: ${this.pendingUploads.size}`)
      }
      
    } catch (error) {
      console.error('Error polling for tracks:', error)
      // On error, back off even more
      this.currentInterval = Math.min(
        this.currentInterval * 2,
        this.maxInterval
      )
    }
  }

  // Call this after a user uploads a track
  notifyUpload(trackId) {
    console.log(`Upload detected for track ${trackId}, adding to pending uploads`)
    
    // Add to pending uploads
    this.pendingUploads.set(trackId, {
      uploadedAt: Date.now()
    })
    
    // Resume polling if suspended
    if (this.isSuspended) {
      console.log('Resuming polling for new upload')
      this.isSuspended = false
      this.resetBackoff()
    } else {
      this.resetBackoff()
    }
    
    // Force an immediate poll
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
    }
    this.poll().then(() => {
      this.scheduleNextPoll()
    })
  }
}

export default TrackPollingService

