// Simple Router for SoundClone
export class Router {
  constructor() {
    this.routes = new Map()
    this.currentView = 'home'
    this.currentTrackId = null
    this.setupEventListeners()
  }
  
  register(path, handler) {
    this.routes.set(path, handler)
  }
  
  navigate(path, pushState = true) {
    if (pushState) {
      window.history.pushState({ path }, '', `#${path}`)
    }
    this.handleRoute(path)
  }
  
  handleRoute(path = window.location.hash.substring(1)) {
    const [view, ...params] = path.split('/')
    const handler = this.routes.get(view || 'home')
    
    if (handler) {
      this.currentView = view || 'home'
      if (params.length > 0) {
        this.currentTrackId = params[0]
      }
      handler(params)
    }
  }
  
  setupEventListeners() {
    window.addEventListener('hashchange', () => this.handleRoute())
    window.addEventListener('popstate', (e) => {
      if (e.state && e.state.path) {
        this.handleRoute(e.state.path)
      }
    })
    
    // Delegate click events for navigation
    document.addEventListener('click', (e) => {
      const navLink = e.target.closest('[data-view]')
      if (navLink) {
        e.preventDefault()
        const view = navLink.getAttribute('data-view')
        const trackId = navLink.getAttribute('data-track-id')
        
        if (trackId) {
          this.navigate(`${view}/${trackId}`)
        } else {
          this.navigate(view)
        }
      }
    })
  }
}
