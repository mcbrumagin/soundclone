import { tags } from 'micro-js-html'

const { nav, a, i } = tags

export default function Navigation (currentView) {
  return nav({ class: 'nav-links' },
    a({ 
      class: currentView === 'home' ? 'active' : '', 
      href: '#home',
      'data-view': 'home' 
    }, 'Home'),
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
}
