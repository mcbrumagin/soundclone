import { htmlTags } from 'micro-js-html'

const { div, h2, button, a, header, i } = htmlTags

// Format seconds to mm:ss
const formatTime = (seconds) => {
  seconds = Math.floor(seconds || 0)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

export default class HomeView {
  constructor(player) {
    this.player = player
  }

  togglePlayPause() {
    if (this.player.isPlaying) {
      player.pause()
    } else {
      // If no track is loaded, load the first available track
      if (!player.currentTrack && window.tracks.length > 0) {
        const firstTrack = window.tracks[0]
        this.loadTrack(firstTrack, true) // autoplay = true
      } else {
        player.play()
      }
    }
  }

  loadTrack(track, autoplay = false) {
    this.player.loadTrack(track)
    appState.currentlyPlayingTrackId = track.id || null
    if (autoplay) {
      player.play()
    }
  }

  renderTrackCard(track) {
    const { isPlaying, currentlyPlayingTrackId } = window.appState
    const isThisTrackPlaying = isPlaying && currentlyPlayingTrackId === track.id
    const isThisTrackPaused = !isPlaying && currentlyPlayingTrackId === track.id
    
    console.log('isThisTrackPlaying', isThisTrackPlaying)
    console.log('track.id', track.id)
    console.log({track})
    console.log('isPlaying', isPlaying)
    console.log('currentlyPlayingTrackId', currentlyPlayingTrackId)

    return div({ class: 'track-card' },
      div({ class: 'track-card-header' },
        h2({ class: 'track-title' }, track.title),
        div({ class: 'track-date' }, 
          `${new Date(track.createdAt).toLocaleDateString()} - ${formatTime(track.duration || 0)}`
        )
      ),
      div({ class: 'track-actions' },
        button({ 
          class: `play-track ${isThisTrackPlaying ? 'playing' : ''}`, 
          onClick: () => {
            if (isThisTrackPlaying) this.player.pause()
            else this.player.play(track.id)
            // else this.playTrackById(track.id)
          }
        }, 
          i({ class: isThisTrackPlaying ? 'fas fa-pause' : 'fas fa-play' }), 
          isThisTrackPlaying ? ' Pause' : isThisTrackPaused ? 'Resume' : ' Play'
        ),
        a({ 
          class: 'secondary view-track', 
          'data-view': 'track-detail',
          'data-track-id': track.id,
          href: `#track-detail/${track.id}` 
        }, 'View Details')
      )
    )
  }

  render() {
    if (window.tracks.length === 0) {
      return div({ class: 'loading' }, 'Loading...')
    }

    return div({ class: 'track-list' }, 
      ...window.tracks.map(track => this.renderTrackCard(track))
    )
  }
}
