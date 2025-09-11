import { tags, renderHelper } from 'micro-js-html'
// Removed router import - using simple hashchange handler
import { Navigation } from './components/navigation.js'
import { HomeView } from './views/home.js'
import { UploadView } from './views/upload.js'
import { RecordView } from './views/record.js'
import { TrackDetailView } from './views/track-detail.js'

const { div, header, span, input, h2, button } = tags

// Initialize audio player system
let player, trackManager, playerUI;

// View instances
const homeView = new HomeView()
const uploadView = new UploadView()
const recordView = new RecordView()
const trackDetailView = new TrackDetailView()

// Simple router state
const router = {
  currentView: 'home',
  currentTrackId: null
}

// Global app state
const appState = {
  currentlyPlayingTrackId: null,
  isPlaying: false
}
window.appState = appState

// const render = vnode => {
//   const root = document.querySelector('#app')
//   root.innerHTML = vnode
// }

const render = renderHelper('#app')
const renderPlayer = renderHelper('#audio-player')

// Separate player UI update function (no full re-render)
const updatePlayerUI = () => {
  if (window.audioSystem && window.audioSystem.playerUI) {
    const playerElements = {
      playButton: document.getElementById('playerPlayButton'),
      progressSlider: document.getElementById('playerProgressSlider'),
      timeDisplay: document.getElementById('playerTimeDisplay'),
      volumeSlider: document.getElementById('volumeSlider')
    };
    
    // Update the PlayerUI elements reference
    if (Object.values(playerElements).some(el => el)) {
      window.audioSystem.playerUI.elements = playerElements
    }
  }
  
  // Update play button state without full re-render
  const playButton = document.getElementById('playerPlayButton')
  if (playButton) {
    const icon = playButton.querySelector('span')
    if (icon) {
      icon.textContent = appState.isPlaying ? '⏸' : '▶'
    }
  }
}

// Simple render helper
window.renderApp = async () => {
  console.log('Rendering app for view:', router.currentView)
  const currentView = router.currentView
  let content
  
  try {
    switch(currentView) {
      case 'home': 
        // Load tracks if needed
        if (homeView.tracks.length === 0) {
          window.tracks = await homeView.loadTracks()
        }
        content = div({ class: 'track-list' }, homeView.render())
        break
      case 'upload': 
        content = uploadView.render()
        // setTimeout(() => uploadView.setupEventListeners(), 0)
        break
      case 'record': 
        content = recordView.render()
        break
      case 'track-detail': 
        // Load track details if needed
        if (router.currentTrackId && (!trackDetailView.currentTrack || trackDetailView.currentTrack.id !== router.currentTrackId)) {
          await trackDetailView.loadTrack(router.currentTrackId)
        }
        content = trackDetailView.render()
        setTimeout(() => trackDetailView.setupEventListeners(), 0)
        break
      default:
        content = div({ class: 'loading' }, 'Loading...')
    }
  } catch (err) {
    console.error('Error rendering view:', err)
    content = div({ class: 'error-message' }, `Failed to load ${currentView} view`)
  }
  
  render(App(content, currentView))
}

// Separate audio player rendering function
window.renderAudioPlayer = () => {
  renderPlayer(AudioPlayerUI())
  
  // Reinitialize PlayerUI after render to ensure it can find the DOM elements
  setTimeout(() => {
    updatePlayerUI()
  }, 0)
}

// Global audio system for view access
window.audioSystem = {
  player: null,
  trackManager: null,
  playerUI: null,
  loadTrack: (track, autoplay = false) => {
    console.log('Loading track:', track)
    // Implementation will be added when audio system is ready
  },
  play: () => {
    console.log('Play requested')
    // Implementation will be added when audio system is ready
  },
  togglePlayPause: () => {
    console.log('Toggle play/pause requested')
    // Implementation will be added when audio system is ready
  },
  seekTo: (time) => {
    console.log('Seek to:', time)
    // Implementation will be added when audio system is ready
  }
}

// Simple hash-based routing
const handleRouteChange = () => {
  const hash = window.location.hash.substring(1) || 'home'
  const [view, ...params] = hash.split('/')
  
  router.currentView = view
  router.currentTrackId = params[0] || null
  
  console.log('Route changed to:', view, params)
  renderApp()
}

// Set up routing
window.addEventListener('hashchange', handleRouteChange)
window.addEventListener('popstate', handleRouteChange)

// Main App Component
const App = (viewContent, currentView) =>
  div({ class: 'app' },
    header({ class: 'container header-content' },
      div({ class: 'logo' }, 'SoundClone v0'),
      Navigation(currentView)
    ),
    viewContent
  )

// Audio Player UI Component
const AudioPlayerUI = () =>
  div({ class: 'audio-player' },
    div({ class: 'player-controls' },
      button({ 
        id: 'playerPlayButton', 
        class: 'play-button',
        onclick: () => {
          if (window.audioSystem && window.audioSystem.togglePlayPause) {
            window.audioSystem.togglePlayPause()
          }
        }
      }, 
        span({}, appState.isPlaying ? '⏸' : '▶')
      ),
      div({ class: 'progress-container' },
        input({ 
          type: 'range', 
          id: 'playerProgressSlider', 
          class: 'progress-slider', 
          min: '0', 
          max: '100', 
          value: '0',
          oninput: (e) => {
            if (window.audioSystem && window.audioSystem.player && window.audioSystem.player.audio) {
              const duration = window.audioSystem.player.audio.duration
              console.log('Duration:', duration)
              if (duration && !isNaN(duration) && isFinite(duration)) {
                const seekTime = (parseFloat(e.target.value) / 100) * duration
                if (!isNaN(seekTime) && isFinite(seekTime)) {
                  window.audioSystem.seekTo(seekTime)
                }
              }
            }
          }
        }),
        span({ id: 'playerTimeDisplay', class: 'time-display' }, '0:00 / 0:00')
      ),
      div({ class: 'volume-container' },
        span({}, '🔊'),
        input({ 
          type: 'range', 
          id: 'volumeSlider', 
          class: 'volume-slider', 
          min: '0', 
          max: '1', 
          step: '0.1', 
          value: '1',
          oninput: (e) => {
            if (window.audioSystem && window.audioSystem.player) {
              window.audioSystem.player.setVolume(parseFloat(e.target.value))
            }
          }
        })
      )
    )
  )

const bootstrap = async () => {
  // Initialize audio player system
  player = new AudioPlayer();
  trackManager = new TrackManager(player);
  
  // Update global audio system
  window.audioSystem.player = player
  window.audioSystem.trackManager = trackManager
  window.audioSystem.loadTrack = (track, autoplay = false) => {
    player.loadTrack(track)
    appState.currentlyPlayingTrackId = track.id || null
    if (autoplay) {
      player.play()
    }
  }
  window.audioSystem.play = () => player.play()
  window.audioSystem.togglePlayPause = () => {
    if (player.isPlaying) {
      player.pause()
    } else {
      // If no track is loaded, load the first available track
      if (!player.currentTrack && trackManager.tracks.length > 0) {
        const firstTrack = trackManager.tracks[0]
        window.audioSystem.loadTrack(firstTrack, true) // autoplay = true
      } else {
        player.play()
      }
    }
  }
  window.audioSystem.seekTo = (time) => {
    if (player.audio && !isNaN(time) && isFinite(time) && time >= 0) {
      player.audio.currentTime = time
    }
  }
  
  // Listen for play/pause events to update global state
  player.on('play', () => {
    appState.isPlaying = true
    // Update just the player UI, not the full app
    setTimeout(() => renderAudioPlayer(), 0)
    // Only re-render track buttons when needed
    if (router.currentView === 'home') {
      setTimeout(() => renderApp(), 0)
    }
  })
  
  player.on('pause', () => {
    appState.isPlaying = false
    setTimeout(() => renderAudioPlayer(), 0)
    if (router.currentView === 'home') {
      setTimeout(() => renderApp(), 0)
    }
  })
  
  player.on('ended', () => {
    appState.isPlaying = false
    appState.currentlyPlayingTrackId = null
    setTimeout(() => renderAudioPlayer(), 0)
    if (router.currentView === 'home') {
      setTimeout(() => renderApp(), 0)
    }
  })
  
  // Pass audio system to home view
  homeView.audioSystem = window.audioSystem
  
  // Initialize UI after render
  setTimeout(() => {
    const playerElements = {
      playButton: document.getElementById('playerPlayButton'),
      progressSlider: document.getElementById('playerProgressSlider'),
      timeDisplay: document.getElementById('playerTimeDisplay'),
      volumeSlider: document.getElementById('volumeSlider')
    };
    
    if (Object.values(playerElements).some(el => el)) {
      playerUI = new PlayerUI(player, playerElements);
      window.audioSystem.playerUI = playerUI
    }
  }, 100);

  // Start with loading message
  render(div({ class: 'loading' }, 'Loading...'))
  
  // Render initial audio player
  renderAudioPlayer()
  
  // Handle initial route
  handleRouteChange()
  
  // If no hash is present, ensure we start at home
  if (!window.location.hash) {
    window.location.hash = '#home'
  }
}

bootstrap() 