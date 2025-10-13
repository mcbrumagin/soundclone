import { htmlTags } from 'micro-js-html'
const { div, input, button, span } = htmlTags

class AudioPlayer {
  constructor() {
    this.audio = new Audio()
    this.currentTrack = null
    this.volume = 1
    this.listeners = {}
    
    this.setupEventListeners()
  }

  loadTrack(track) {
    console.log('loadTrack into player', track)
    this.currentTrack = track
    // Construct the audio URL using the server's API endpoint
    this.audio.src = `/api/audio/${track.id}`
    console.log('Loading audio from:', this.audio.src)
    this.audio.load()
  }

  async play(trackId) {
    if (!window.tracks.length === 0) {
      console.warn('No tracks to play')
      return false
    }

    let track
    if (trackId && trackId !== appState.currentlyPlayingTrackId) {
      // TODO appState instead of window
      track = window.tracks.find(t => t.id === trackId)
      trackId = track.id
    }

    // default to the first track on the page
    // might break in the future if appState holds all tracks even for playlist pages
    if (!this.currentTrack) {
      track = window.tracks[0]
    }

    this.loadTrack(track)
    await this.audio.play()

    // TODO refactor to use single appState.currentTrack w/ data (name display is missing)
    appState.isPlaying = true // redundant
    appState.isPlaying = true
    appState.currentlyPlayingTrackId = this.currentTrack.id

    // TODO renderHelpers just for play status progress/buttons
    window.renderApp()
    window.renderPlayer()
    return true
  }

  pause() {
    this.audio.pause()
    appState.isPlaying = false
    window.renderApp()
    window.renderPlayer(this.render())
  }

  toggle() {
    return appState.isPlaying ? this.pause() : this.play()
  }

  seek(time) {
    this.audio.currentTime = time
  }

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume))
    this.audio.volume = this.volume
  }

  setupEventListeners() {
    // TODO seems silly and redundant
    this.audio.addEventListener('timeupdate', () => {
      this.emit('timeupdate', {
        currentTime: this.audio.currentTime,
        duration: this.audio.duration
      })
    })

    this.audio.addEventListener('ended', () => {
      appState.isPlaying = false
      window.renderApp()
    })

    // this.audio.addEventListener('loadedmetadata', () => {
    //   this.emit('loaded', {
    //     duration: this.audio.duration
    //   })
    // })

    this.audio.addEventListener('error', (error) => {
      console.error('Audio error:', error)
      this.emit('error', error)
    })
  }

  // Simple event emitter
  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data))
    }
  }

  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = []
    this.listeners[event].push(callback)
  }

  // UI update methods
  updateProgress({ currentTime }) {
    // Update progress slider
    const progressSlider = document.getElementById('playerProgressSlider')
    const duration = this.currentTrack.duration
    if (progressSlider && duration) {
      const progress = (currentTime / duration) * 100
      progressSlider.value = progress || 0
    }
    
    // Update time display
    const timeDisplay = document.getElementById('playerTimeDisplay')
    if (timeDisplay) {
      const current = this.formatTime(currentTime || 0)
      const total = this.formatTime(this.currentTrack.duration || 0)
      // console.log({total})
      timeDisplay.textContent = `${current} / ${total}`
    }
  }

  updatePlayButton(isPlaying) {
    const playButton = document.getElementById('playerPlayButton')
    if (playButton) {
      const icon = playButton.querySelector('span')
      if (icon) {
        icon.textContent = isPlaying ? '⏸' : '▶'
      }
    }
  }

  updateDuration(duration) {
    const progressSlider = document.getElementById('playerProgressSlider')
    if (progressSlider) {
      progressSlider.max = 100
    }
    
    // Update time display to show total duration
    const timeDisplay = document.getElementById('playerTimeDisplay')
    if (timeDisplay && duration) {
      timeDisplay.textContent = `0:00 / ${this.formatTime(duration)}`
    }
  }

  // TODO redundant
  formatTime(seconds) {
    if (!seconds || isNaN(seconds) || !isFinite(seconds) || seconds < 0) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  seekTo(time) {
    if (this.audio && !isNaN(time) && isFinite(time) && time >= 0) {
      this.audio.currentTime = time
    }
  }

  // Setup UI event listeners after render
  setupUI(track) {
    // if (!track) {
    //   console.warn('no track')
    //   return
    // }
    // Bind player events to update UI
    this.on('timeupdate', (data) => {
      
      this.updateProgress(data)

      // TODO need to clean up updateProgress/etc for stateful updates
      // maybe use a renderHelper for the progress/time display
      console.log('updating current track time', data.currentTime)
      if (track) {
        data.duration = track.duration
        // console.log('timeupdate', data)
        
        // track.currentTime = data.currentTime
        this.currentTrack.currentTime = data.currentTime
        // this.audio.currentTime
      }
    })

    // TODO flashes 0:00?
    // this.on('loaded', (data) => {
    //   this.updateDuration(data.duration)
    // })

    this.on('play', () => {
      this.updatePlayButton(true)
    })

    this.on('pause', () => {
      this.updatePlayButton(false)
    })

    this.on('ended', () => {
      this.updatePlayButton(false)
    })

    this.on('error', (error) => {
      console.error('Player UI error:', error)
      this.updatePlayButton(false)
    })
  }

  convertDurationToDisplay(duration) {
    let minutes = Math.floor(duration / 60)
    let seconds = Math.floor(duration % 60)
    console.log('render convert', {minutes, seconds})
    if (!isNaN(minutes) && !isNaN(seconds)) {
      // if (minutes.toString().length === 1) seconds = '0' + minutes
      if (seconds.toString().length === 1) seconds = '0' + seconds
      return `${minutes}:${seconds}`
    } else return '0:00'
  }

  render(track) {
    this.setupUI(track)

    let duration = this.convertDurationToDisplay(this.currentTrack?.duration)
    let currentTime = this.convertDurationToDisplay(this.audio?.currentTime || this.currentTrack?.currentTime)

    console.log('render currentTime', currentTime)
    console.log('render duration', duration)

    return div({ class: 'audio-player' },
      div({ class: 'player-controls' },
        button({ 
          id: 'playerPlayButton', 
          class: 'play-button',
          onclick: () => this.toggle()
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
              // use fresh currentTrack reference to catch updates
              if (this.currentTrack && this.currentTrack.duration) {
                const seekTime = (parseFloat(e.target.value) / 100) * this.currentTrack.duration
                if (!isNaN(seekTime) && isFinite(seekTime)) {
                  this.seekTo(seekTime)
                }
              }
            }
          }),
          span({ id: 'playerTimeDisplay', class: 'time-display' }, `${currentTime} / ${duration}`)
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
              this.setVolume(parseFloat(e.target.value))
            }
          })
        )
      )
    )
  }
}

export default AudioPlayer;
