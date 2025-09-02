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

// const render = vnode => {
//   const root = document.querySelector('#app')
//   root.innerHTML = vnode
// }

const render = renderHelper('#app')

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
          await homeView.loadTracks()
        }
        content = div({ class: 'track-list' }, homeView.render())
        break
      case 'upload': 
        content = uploadView.render()
        // setTimeout(() => uploadView.setupEventListeners(), 0)
        break
      case 'record': 
        content = recordView.render()
        setTimeout(() => recordView.setupEventListeners(), 0)
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
    viewContent,
    AudioPlayerUI()
  )

// Audio Player UI Component
const AudioPlayerUI = () =>
  div({ class: 'audio-player' },
    div({ class: 'player-controls' },
      button({ 
        id: 'playerPlayButton', 
        class: 'play-button' 
      }, 
        span({}, '▶')
      ),
      div({ class: 'progress-container' },
        input({ 
          type: 'range', 
          id: 'playerProgressSlider', 
          class: 'progress-slider', 
          min: '0', 
          max: '100', 
          value: '0' 
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
          value: '1' 
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
    console.log('loadTrack:', track)
    player.loadTrack(track)
    if (autoplay) {
      player.play()
    }
  }
  window.audioSystem.play = () => player.play()
  window.audioSystem.togglePlayPause = () => {
    if (player.isPlaying) {
      player.pause()
    } else {
      player.play()
    }
  }
  window.audioSystem.seekTo = (time) => {
    if (player.audio) {
      player.audio.currentTime = time
    }
  }
  
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
  
  // Handle initial route
  handleRouteChange()
}

bootstrap() 