import { tags } from 'micro-js-html'
import { Router } from './router.js'
import { Navigation } from './components/navigation.js'
import { HomeView } from './views/home.js'
import { UploadView } from './views/upload.js'
import { RecordView } from './views/record.js'
import { TrackDetailView } from './views/track-detail.js'

const { div, header, span, input, h2 } = tags

// Initialize audio player system
let player, trackManager, playerUI;

// View instances
const homeView = new HomeView()
const uploadView = new UploadView()
const recordView = new RecordView()
const trackDetailView = new TrackDetailView()

const router = new Router()

const render = vnode => {
  const root = document.querySelector('#app')
  root.innerHTML = vnode
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

// Route handlers
const showHome = async () => {
  try {
    await homeView.loadTracks()
    renderView('home')
  } catch (err) {
    console.error('Error loading home view:', err)
    render(div({ class: 'error-message' }, 'Failed to load tracks'))
  }
}

const showUpload = () => {
  renderView('upload')
  // Set up event listeners after render
  setTimeout(() => uploadView.setupEventListeners(), 0)
}

const showRecord = () => {
  renderView('record')
  // Set up event listeners after render
  setTimeout(() => recordView.setupEventListeners(), 0)
}

const showTrackDetail = async (params) => {
  const trackId = params[0]
  if (trackId) {
    try {
      await trackDetailView.loadTrack(trackId)
      renderView('track-detail')
      // Set up event listeners after render
      setTimeout(() => trackDetailView.setupEventListeners(), 0)
    } catch (err) {
      console.error('Error loading track detail:', err)
      render(div({ class: 'error-message' }, 'Failed to load track details'))
    }
  }
}

const renderView = (viewName) => {
  let viewContent
  
  switch (viewName) {
    case 'upload':
      viewContent = uploadView.render()
      break
    case 'record':
      viewContent = recordView.render()
      break
    case 'track-detail':
      viewContent = trackDetailView.render()
      break
    case 'home':
    default:
      viewContent = div({ class: 'track-list' }, homeView.render())
      break
  }
  
  const app = App(viewContent, viewName)
  render(app)
}

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

  // Register routes
  router.register('home', showHome)
  router.register('upload', showUpload)
  router.register('record', showRecord)
  router.register('track-detail', showTrackDetail)
  
  // Handle view updates
  document.addEventListener('view-update', () => {
    renderView(router.currentView)
  })
  
  // Start with loading message
  render(div({ class: 'loading' }, 'Loading...'))
  
  // Handle initial route
  router.handleRoute()
}

bootstrap() 