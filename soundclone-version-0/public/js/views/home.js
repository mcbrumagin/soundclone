import { tags } from 'micro-js-html'
import { getTracks } from '../api.js'

const { div, h2, button, a, header, i } = tags

// Format seconds to mm:ss
const formatTime = (seconds) => {
  seconds = Math.floor(seconds || 0)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

const TrackCard = (track, playTrack) =>
  div({ class: 'track-card' },
    div({ class: 'track-card-header' },
      h2({ class: 'track-title' }, track.title),
      div({ class: 'track-date' }, 
        `${new Date(track.createdAt).toLocaleDateString()} - ${formatTime(track.duration || 0)}`
      )
    ),
    div({ class: 'track-actions' },
      button({ class: 'play-track', onClick: () => playTrack(track.id) }, 
        i({ class: 'fas fa-play' }), ' Play'
      ),
      a({ 
        class: 'secondary view-track', 
        'data-view': 'track-detail',
        'data-track-id': track.id,
        href: `#track-detail/${track.id}` 
      }, 'View Details')
    )
  )

export class HomeView {
  constructor(audioSystem) {
    this.tracks = []
    this.audioSystem = audioSystem
  }

  async loadTracks() {
    try {
      this.tracks = await getTracks()
      console.log('Tracks loaded from API:', this.tracks)
      
      // Load tracks into TrackManager
      if (this.audioSystem.trackManager) {
        await this.audioSystem.trackManager.loadTracks()
        console.log('Tracks loaded into TrackManager:', this.audioSystem.trackManager.tracks)
      }
      
      return this.tracks
    } catch (err) {
      console.error('Error loading tracks:', err)
      throw err
    }
  }

  async playTrack(id) {
    console.log('Play button clicked for track:', id)
    
    if (!this.audioSystem.trackManager) {
      console.error('TrackManager not initialized')
      return
    }

    try {
      // Get the track data
      const track = this.audioSystem.trackManager.getTrack(id)
      if (!track) {
        console.error('Track not found:', id)
        console.log('Available track IDs:', this.audioSystem.trackManager.tracks.map(t => t.id))
        return
      }

      console.log('Loading track:', track)
      
      // Load the track into the player
      this.audioSystem.player.loadTrack(track)
      
      // Attempt to play
      const success = await this.audioSystem.player.play()
      if (success) {
        console.log('Track started playing successfully')
      } else {
        console.error('Failed to start playback')
      }
    } catch (error) {
      console.error('Error playing track:', error)
    }
  }

  render() {
    if (this.tracks.length === 0) {
      return div({ class: 'loading' }, 'Loading...')
    }

    return div({ class: 'track-list' }, 
      ...this.tracks.map(track => TrackCard(track, (id) => this.playTrack(id)))
    )
  }
}
