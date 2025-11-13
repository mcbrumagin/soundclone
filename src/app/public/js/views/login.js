import { htmlTags } from 'micro-js-html'
import { showAlert } from '../components/modal.js'

const { div, h1, form, input, button } = htmlTags

export default class LoginView {

  async handleLogin(e) {
    e.preventDefault()
    console.log('handleLogin')
    let user = document.getElementById('loginUsername').value
    let password = document.getElementById('loginPassword').value
    let authResult = await fetch('/', {
      method: 'POST',
      body: JSON.stringify({ authenticate: { user, password } }),
      headers: {
        'Content-Type': 'application/json',
        'micro-command': 'auth-login'
      }
    })

    if (authResult.ok) {
      appState.accessToken = (await authResult.json()).accessToken
      window.location.hash = '#home'
      window.renderApp()
    } else {
      await showAlert('Invalid username or password', 'Login Failed')
    }
  }

  render() {
    return div({ class: 'login-container' },
      h1({ class: 'page-title' }, 'Login'),
      form({ class: 'login-form form-group' },
        input({ 
          class: 'form-control', 
          id: 'loginUsername', 
          type: 'text', 
          placeholder: 'Username',
          autocomplete: 'username',
          autocapitalize: 'off',
          autocorrect: 'off',
          spellcheck: 'false'
        }),
        input({ 
          class: 'form-control', 
          id: 'loginPassword', 
          type: 'password', 
          placeholder: 'Password',
          autocomplete: 'current-password'
        }),
        button({ type: 'submit', onclick: (e) => this.handleLogin(e) }, 'Login')
      )
    )
  }
}