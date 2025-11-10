import { htmlTags } from 'micro-js-html'

const { nav, a, i } = htmlTags

export default function Navigation (currentView) {
  let isLoggedIn = appState.accessToken

  let loggedInNav = []

  if (isLoggedIn) {
    loggedInNav.push(
      a({ 
        class: `nav-button ${currentView === 'upload' ? 'active' : ''}`, 
        href: '#upload',
        'data-view': 'upload' 
      }, 
        i({ class: 'fas fa-upload' }), ' Upload'
      ),
      a({ 
        class: `nav-button ${currentView === 'record' ? 'active' : ''}`, 
        href: '#record',
        'data-view': 'record' 
      }, 
        i({ class: 'fas fa-microphone' }), ' Record'
      )
    )
  } else loggedInNav.push(a({ href: '#login', 'data-view': 'login' }, 'Login'))

  return nav({ class: 'nav-links' },
    a({ 
      class: currentView === 'home' ? 'active' : '', 
      href: '#home',
      'data-view': 'home' 
    }, 'Home'),
    ...loggedInNav
  )
}
