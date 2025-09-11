import { tags } from 'micro-js-html'
const { div, input, button, span } = tags

class AudioPlayer {
  constructor() {
    this.audio = new Audio()
    this.currentTrack = null
    this.isPlaying = false
    this.volume = 1
    this.listeners = {}
    
    this.setupEventListeners()
  }

  loadTrack(track) {
    this.currentTrack = track
    // Construct the audio URL using the server's API endpoint
    this.audio.src = `/api/audio/${track.id}`
    console.log('Loading audio from:', this.audio.src)
    this.audio.load()
  }

  async play() {
    if (!this.currentTrack) return false
    
    try {
      await this.audio.play()
      this.isPlaying = true
      this.emit('play')
      return true
    } catch (error) {
      console.error('Playback failed:', error)
      return false
    }
  }

  pause() {
    this.audio.pause()
    this.isPlaying = false
    this.emit('pause')
  }

  toggle() {
    return this.isPlaying ? this.pause() : this.play()
  }

  seek(time) {
    this.audio.currentTime = time
  }

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume))
    this.audio.volume = this.volume
  }

  setupEventListeners() {
    this.audio.addEventListener('timeupdate', () => {
      this.emit('timeupdate', {
        currentTime: this.audio.currentTime,
        duration: this.audio.duration
      })
    })

    this.audio.addEventListener('ended', () => {
      this.isPlaying = false
      this.emit('ended')
    })

    this.audio.addEventListener('loadedmetadata', () => {
      this.emit('loaded', {
        duration: this.audio.duration
      })
    })

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
  updateProgress({ currentTime, duration }) {
    // Update progress slider
    const progressSlider = document.getElementById('playerProgressSlider')
    if (progressSlider && duration) {
      const progress = (currentTime / duration) * 100
      progressSlider.value = progress || 0
    }
    
    // Update time display
    const timeDisplay = document.getElementById('playerTimeDisplay')
    if (timeDisplay) {
      const current = this.formatTime(currentTime || 0)
      const total = this.formatTime(duration || 0)
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

  formatTime(seconds) {
    if (!seconds || isNaN(seconds) || !isFinite(seconds) || seconds < 0) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Setup UI event listeners after render
  setupUI(track) {
    // Bind player events to update UI
    this.on('timeupdate', (data) => {
      if (track) data.duration = track.duration
      console.log('timeupdate', data)
      this.updateProgress(data)
    })

    this.on('loaded', (data) => {
      this.updateDuration(data.duration)
    })

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

  render(track) {
    // Setup UI event listeners after render
    setTimeout(() => this.setupUI(track), 0)

    return div({ class: 'audio-player' },
      div({ class: 'player-controls' },
        button({ 
          id: 'playerPlayButton', 
          class: 'play-button',
          onclick: () => {
            if (window.audioSystem && window.audioSystem.togglePlayPause) {
              window.audioSystem.togglePlayPause()
            }
          }
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
              if (window.audioSystem && window.audioSystem.player && window.audioSystem.player.audio) {
                const duration = track.duration
                console.log('Duration:', duration)
                if (duration && !isNaN(duration) && isFinite(duration)) {
                  const seekTime = (parseFloat(e.target.value) / 100) * duration
                  if (!isNaN(seekTime) && isFinite(seekTime)) {
                    window.audioSystem.seekTo(seekTime)
                  }
                }
              }
            }
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
            value: '1',
            oninput: (e) => {
              if (window.audioSystem && window.audioSystem.player) {
                window.audioSystem.player.setVolume(parseFloat(e.target.value))
              }
            }
          })
        )
      )
    )
  }
}

export default AudioPlayer;
