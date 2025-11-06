import { htmlTags } from 'micro-js-html'
import renderHelper from './render-helper.js'
// Removed router import - using simple hashchange handler
import Navigation from './components/navigation.js'
import HomeView from './views/home.js'
import LoginView from './views/login.js'
import UploadView from './views/upload.js'
import RecordView from './views/record.js'
import TrackDetailView from './views/track-detail.js'
import AudioPlayer from './audio-player.js'
import { getTracks } from './api.js'

const { div, header } = htmlTags

const player = new AudioPlayer()

// View instances
const homeView = new HomeView(player)
const loginView = new LoginView(player)

// TODO implement player in all views
const uploadView = new UploadView(player)
const recordView = new RecordView(player)
const trackDetailView = new TrackDetailView(player)

// Make track detail view globally accessible for audio player
window.trackDetailView = trackDetailView

// Simple router state
const router = {
  currentView: 'home',
  currentTrackId: null // only for router
}

// Global app state
window.appState = {
  tracks: [], // will init
  player,
  selectedTrackId: null // For desktop sidebar
}

// TODO, targeted render helpers as part of component render fns
const App = () => {
  let content
  switch(router.currentView) {
    case 'home': 
      // Load tracks if needed
      content = homeView.render()
      break
    case 'login':
      content = loginView.render()
      break
    case 'upload':
      content = uploadView.render()
      break
    case 'record':
      content = recordView.render()
      break
    case 'track-detail':
      let track = appState.tracks.find(track => track.id === router.currentTrackId)
      content = trackDetailView.render(track)
      break
    default:
      content = div({ class: 'loading' }, 'Loading...')
  }
  
  return div({ class: 'app' },
    header({},
      div({ class: 'header-content' },
        div({ class: 'logo' }, 'SoundClone v0'),
        Navigation(router.currentView)
      )
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

window.renderAudioButtons = renderHelper('.audio-control', element => {
  // console.log('renderAudioButtons', element)
  console.log({isPlaying: appState.player.isPlaying})
  if (element.classList.contains('player-control')) {
    return player.renderPlayButton(element).render()
  } else {
    return homeView.renderPlayButton(element).render()
  }
})

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

const bootstrap = async () => {

  // TODO helper fn to reuse wherever access token is needed (if the initial auth fails)
  try  {
    // check for refresh token and see if we can update the access token
    let authResult = await fetch('/', {
      method: 'POST',
      body: null,
      headers: {
        'micro-command': 'auth-refresh'
      }
    })

    if (authResult.ok) {
      appState.accessToken = (await authResult.json()).accessToken
      renderApp()
    } else console.error('Error refreshing access token:', authResult)

  } catch (err) {
    console.error('Error refreshing access token:', err)
  }

  if (!appState.tracks || appState.tracks.length === 0) {
    try {
      appState.tracks = await getTracks()
      console.log('Tracks loaded from API:', appState.tracks)
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