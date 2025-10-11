import { htmlTags } from 'micro-js-html'
import renderHelper from './render-helper.js'
// Removed router import - using simple hashchange handler
import Navigation from './components/navigation.js'
import HomeView from './views/home.js'
import UploadView from './views/upload.js'
import RecordView from './views/record.js'
import TrackDetailView from './views/track-detail.js'
import AudioPlayer from './audio-player.js'
import { getTracks } from './api.js'

const { div, header } = htmlTags

const player = new AudioPlayer()

// View instances
const homeView = new HomeView(player)

// TODO implement player in all views
const uploadView = new UploadView(player)
const recordView = new RecordView(player)
const trackDetailView = new TrackDetailView(player)

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
const App = () => {
  let content

  
  try {
    switch(router.currentView) {
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
  
  return div({ class: 'app' },
    header({ class: 'container header-content' },
      div({ class: 'logo' }, 'SoundClone v0'),
      Navigation(router.currentView)
    ),
    content
  )
}

window.renderApp = renderHelper('#app', App)

// TODO renderHelper should support classes with render methods
window.renderPlayer = renderHelper(
  '#audio-player',
  player.render.bind(player) // for now we bind the method to the instance
)


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
// const App = (viewContent, currentView) =>
//   div({ class: 'app' },
//     header({ class: 'container header-content' },
//       div({ class: 'logo' }, 'SoundClone v0'),
//       Navigation(currentView)
//     ),
//     viewContent
//   )

const bootstrap = async () => {

  if (!window.tracks || window.tracks.length === 0) {
    try {
      window.tracks = await getTracks()
      console.log('Tracks loaded from API:', window.tracks)
    } catch (err) {
      console.error('Error loading tracks:', err)
      throw err
    }
  }

  await window.renderApp(div({ class: 'loading' }, 'Loading...'))
  
  // Render initial audio player
  window.renderPlayer()
  
  // Handle initial route
  handleRouteChange()
  
  // If no hash is present, ensure we start at home
  if (!window.location.hash) {
    window.location.hash = '#home'
  }
}

bootstrap() 