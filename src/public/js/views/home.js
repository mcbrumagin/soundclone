import { htmlTags } from 'micro-js-html'

const { div, h2, button, a, span, header, i } = htmlTags

// Format seconds to mm:ss
const formatTime = (seconds) => {
  seconds = Math.floor(seconds || 0)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

export default class HomeView {
  constructor() {

  }

  togglePlayPause() {
    if (appState.player.isPlaying) {
      appState.player.pause()
    } else {
      // If no track is loaded, load the first available track
      if (!appState.player.currentTrack && appState.tracks.length > 0) {
        const firstTrack = appState.tracks[0]
        this.loadTrack(firstTrack, true)
      }
      appState.player.play()
    }
  }

  // loadTrack(track) {
  //   appState.player.loadTrack(track)
  // }

  getTrackState(track) {
    const { isPlaying, currentTrack } = appState.player
    const isThisTrackPlaying = isPlaying && currentTrack.id === track.id
    const isThisTrackPaused = !isPlaying && currentTrack.id === track.id
    return { isThisTrackPlaying, isThisTrackPaused }
  }

  renderPlayButton(element) {
    // element.data
    let track = appState.tracks.find(t => t.id === (element.id || element?.dataset?.trackId))
    let { isPlaying, currentTrack } = appState.player
    const isThisTrackPlaying = isPlaying && currentTrack.id === track.id
    const isThisTrackPaused = !isPlaying && currentTrack.id === track.id
    console.log({trackId: track.id, isThisTrackPlaying, isThisTrackPaused})
    return span(
      i({ class: isThisTrackPlaying ? 'fas fa-pause' : 'fas fa-play' }), 
      isThisTrackPlaying ? ' Pause' : isThisTrackPaused ? 'Resume' : ' Play'
    )
  }

  renderTrackCard(track) {
    return div({ class: 'track-card' },
      div({ class: 'track-card-header' },
        h2({ class: 'track-title' }, track.title),
        div({ class: 'track-date' }, 
          `${new Date(track.createdAt).toLocaleDateString()} - ${formatTime(track.duration || 0)}`
        )
      ),
      div({ class: 'track-actions' },
        button({ 
          class: `play-track audio-control`,
          "data-track-id": track.id,
          onClick: () => {
            let { isThisTrackPlaying } = this.getTrackState(track)
            if (isThisTrackPlaying) appState.player.pause()
            else appState.player.play(track.id)
          }
        },
          this.renderPlayButton(track)
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
    if (!appState.tracks || appState.tracks.length === 0) {
      return div({ class: 'loading' }, 'No tracks found')
    }

    return div({ class: 'track-list' }, 
      ...appState.tracks.map(track => this.renderTrackCard(track))
    )
  }
}
