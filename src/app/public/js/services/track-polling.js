import { getTracks } from '../api.js'

class TrackPollingService {
  constructor() {
    this.minInterval = 2000 // 2 seconds - fast check after upload
    this.maxInterval = 60000 // 60 seconds - max backoff
    this.currentInterval = this.minInterval
    this.backoffMultiplier = 1.5
    this.timeoutId = null
    this.isPolling = false
    this.lastTrackCount = 0
    this.lastTrackIds = new Set()
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

    this.timeoutId = setTimeout(async () => {
      await this.poll()
      this.scheduleNextPoll()
    }, this.currentInterval)

    console.log(`Next poll scheduled in ${this.currentInterval}ms`)
  }

  async poll() {
    try {
      const tracks = await getTracks()
      
      // Create set of current track IDs
      const currentTrackIds = new Set(tracks.map(t => t.id))
      
      // Check if there are new tracks
      const hasNewTracks = this.lastTrackCount === 0 || 
        tracks.length !== this.lastTrackCount ||
        !this.areSetsSame(currentTrackIds, this.lastTrackIds)
      
      if (hasNewTracks && this.lastTrackCount > 0) {
        console.log('New tracks detected!', {
          oldCount: this.lastTrackCount,
          newCount: tracks.length
        })
        
        // Call the callback with new tracks
        if (this.onNewTracks) {
          this.onNewTracks(tracks)
        }
      }
      
      // Update state
      this.lastTrackCount = tracks.length
      this.lastTrackIds = currentTrackIds
      
      // Increase interval (exponential backoff)
      this.currentInterval = Math.min(
        this.currentInterval * this.backoffMultiplier,
        this.maxInterval
      )
      
    } catch (error) {
      console.error('Error polling for tracks:', error)
      // On error, back off even more
      this.currentInterval = Math.min(
        this.currentInterval * 2,
        this.maxInterval
      )
    }
  }

  areSetsSame(set1, set2) {
    if (set1.size !== set2.size) return false
    for (const item of set1) {
      if (!set2.has(item)) return false
    }
    return true
  }

  // Call this after a user uploads a track
  notifyUpload() {
    console.log('Upload detected, resetting polling interval')
    this.resetBackoff()
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

