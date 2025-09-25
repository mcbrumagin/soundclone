import { tags, renderHelper } from 'micro-js-html'
// Removed router import - using simple hashchange handler
import Navigation from './components/navigation.js'
import HomeView from './views/home.js'
import UploadView from './views/upload.js'
import RecordView from './views/record.js'
import TrackDetailView from './views/track-detail.js'
import AudioPlayer from './audio-player.js'
import { getTracks } from './api.js'

const { div, header } = tags

window.player = new AudioPlayer()

// View instances
const homeView = new HomeView(window.player)
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

// TODO, targeted render helpers as part of component render fns
const render = renderHelper('#app')
window.renderPlayer = renderHelper('#audio-player')



// Simple render helper
window.renderApp = async () => {
  console.log('Rendering app for view:', router.currentView)
  const currentView = router.currentView
  let content

  if (!window.tracks || window.tracks.length === 0) {
    try {
      window.tracks = await getTracks()
      console.log('Tracks loaded from API:', window.tracks)
    } catch (err) {
      console.error('Error loading tracks:', err)
      throw err
    }
  }
  
  try {
    switch(currentView) {
      case 'home': 
        // Load tracks if needed
        content = div({ class: 'track-list' }, homeView.render())
        break
      case 'upload':
        content = uploadView.render()
        break
      case 'record':
        content = recordView.render()
        break
      case 'track-detail':
        // TODO tracks should be global state?
        let track = window.tracks.find(track => track.id === router.currentTrackId)
        content = trackDetailView.render(track)
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



// Simple hash-based routing
const handleRouteChange = () => {
  const hash = window.location.hash.substring(1) || 'home'
  const [view, ...params] = hash.split('/')
  
  router.currentView = view
  router.currentTrackId = params[0] || null
  
  console.log('Route changed to:', view, params)
  window.renderApp()
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

const bootstrap = async () => {

  // Start with loading message
  render(div({ class: 'loading' }, 'Loading...'))
  
  // Render initial audio player
  renderPlayer(window.player.render())
  
  // Handle initial route
  handleRouteChange()
  
  // If no hash is present, ensure we start at home
  if (!window.location.hash) {
    window.location.hash = '#home'
  }
}

bootstrap() 