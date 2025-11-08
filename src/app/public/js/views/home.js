import { htmlTags } from 'micro-js-html'
import TrackDetailView from './track-detail.js'

const { div, h2, button, a, span, header, i, p, main } = htmlTags

// Format seconds to mm:ss
const formatTime = (seconds) => {
  seconds = Math.floor(seconds || 0)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

export default class HomeView {
  constructor() {
    this.trackDetailView = new TrackDetailView()
    // Make it globally accessible for audio player updates
    window.trackDetailView = this.trackDetailView
    // Bind render methods
    this.renderTrackListOnly = this.renderTrackListOnly.bind(this)
    this.renderSidebarOnly = this.renderSidebarOnly.bind(this)
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
    const isThisTrackPlaying = currentTrack && isPlaying && currentTrack.id === track.id
    const isThisTrackPaused = currentTrack && !isPlaying && currentTrack.id === track.id
    return { currentTrack, isPlaying, isThisTrackPlaying, isThisTrackPaused }
  }

  renderPlayButton(element) {
    // element.data
    let track = appState.tracks.find(t => t.id === (element.id || element?.dataset?.trackId))
    let { currentTrack, isPlaying, isThisTrackPlaying, isThisTrackPaused } = this.getTrackState(track)
    console.log({trackId: track.id, currentTrack, isThisTrackPlaying, isThisTrackPaused})
    return span(
      i({ class: isThisTrackPlaying ? 'fas fa-pause' : 'fas fa-play' }), 
      isThisTrackPlaying ? ' Pause' : isThisTrackPaused ? 'Resume' : ' Play'
    )
  }

  renderTrackCard(track) {
    return div({ 
      class: 'track-card',
      onclick: (e) => {
        // On desktop, clicking card opens sidebar (unless clicking on interactive elements)
        if (window.innerWidth > 1024) {
          // Don't trigger if clicking on buttons or links
          if (e.target.tagName === 'BUTTON' || 
              e.target.tagName === 'A' || 
              e.target.closest('button') || 
              e.target.closest('a')) {
            return
          }
          
          if (appState.selectedTrackId !== track.id) {
            appState.selectedTrackId = track.id
            window.renderApp() // TODO render track detail
          }
        }
      },
      style: window.innerWidth > 1024 ? 'cursor: pointer;' : ''
    },
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
          onClick: (e) => {
            e.stopPropagation() // Prevent card click
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
          // Normal navigation - goes to full detail page on both mobile and desktop
        }, 'Full Page')
      )
    )
  }

  renderTrackDetailSidebar(track) {
    if (!track) return null
    
    // Store the current track in the detail view
    this.trackDetailView.currentTrack = track
    this.trackDetailView.comments = track.comments || []
    
    // Get the full detail view content
    const detailContent = this.trackDetailView.render(track)
    
    // Extract the inner content (skip the outer main and back button)
    // We'll wrap it in our sidebar container with close button
    return div({ class: 'track-detail-sidebar' },
      button({ 
        class: 'close-detail',
        onclick: () => {
          appState.selectedTrackId = null
          window.renderApp()
        }
      }, '✕'),
      // Render the detail view content directly
      ...detailContent.children.slice(1) // Skip the back button
    )
  }

  // Separate render method for just the track list
  renderTrackListOnly() {
    if (!appState.tracks || appState.tracks.length === 0) {
      return '<div class="loading">No tracks found</div>'
    }
    
    return appState.tracks.map(track => this.renderTrackCard(track).render()).join('')
  }

  // Separate render method for just the sidebar
  renderSidebarOnly() {
    const selectedTrack = appState.selectedTrackId 
      ? appState.tracks.find(t => t.id === appState.selectedTrackId)
      : null
    
    if (!selectedTrack) {
      return ''
    }
    
    return this.renderTrackDetailSidebar(selectedTrack).render()
  }

  render() {
    if (!appState.tracks || appState.tracks.length === 0) {
      return main({ class: 'container' },
        div({ class: 'loading' }, 'No tracks found')
      )
    }

    const selectedTrack = appState.selectedTrackId 
      ? appState.tracks.find(t => t.id === appState.selectedTrackId)
      : null

    // Check if we're on desktop (> 1024px)
    const isDesktop = typeof window !== 'undefined' && window.innerWidth > 1024

    if (isDesktop && selectedTrack) {
      return main({ class: 'container' },
        div({ class: 'home-layout' },
          div({ class: 'track-list-column' },
            div({ class: 'track-list', id: 'trackList' }, 
              ...appState.tracks.map(track => this.renderTrackCard(track))
            )
          ),
          div({ id: 'trackDetailSidebar' },
            this.renderTrackDetailSidebar(selectedTrack)
          )
        )
      )
    }

    return main({ class: 'container' },
      div({ class: 'track-list', id: 'trackList' }, 
        ...appState.tracks.map(track => this.renderTrackCard(track))
      )
    )
  }
}
