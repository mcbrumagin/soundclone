import { htmlTags } from 'micro-js-html'
const { div, input, button, span } = htmlTags

class AudioPlayer {
  constructor() {
    this.audio = new Audio()
    this.currentTrack = { id: 'N/A' }
    this.volume = 1
    
    this.setupEventListeners()
  }

  loadTrack(track) {
    if (!track) track = appState.tracks[0]
    console.log('loadTrack into player', track)
    this.currentTrack = track
    this.audio.src = track?.audioUrl || `/api/audio/${track.id}`
    this.audio.load()
  }

  async play(trackId) {
    if (!appState.tracks.length === 0) {
      console.warn('No tracks to play')
      return false
    }

    let track = appState.tracks.find(t => t.id === trackId)

    // console.log({track, trackId, current: this.currentTrack})

    if (!this.currentTrack || track && this.currentTrack.id !== track.id) {
      this.loadTrack(track)
    }
    
    await this.audio.play()

    return true
  }

  pause() {
    this.audio.pause()
    window.renderAudioButtons()
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

  setupEventListeners() {
    this.audio.addEventListener('timeupdate', data => {
      // console.log('timeupdate event', data)
      let { currentTime, duration } = this.audio
      this.updateProgress({ currentTime, duration })
    })

    this.audio.addEventListener('loaded', data => {
      console.log('loaded event', data)
      // duration = this.audio.duration
      // this.updateDuration(duration)
      window.renderPlayer()
      window.renderApp()
    })

    this.audio.addEventListener('play', data => {
      console.log('play event', data)
      this.isPlaying = true
      this.isPaused = true
      window.renderAudioButtons()
      // window.renderApp()
    })

    this.audio.addEventListener('pause', data => {
      console.log('pause event', data)
      this.isPlaying = false
      this.isPaused = true
      window.renderAudioButtons()
      // window.renderApp()
    })

    this.audio.addEventListener('ended', data => {
      console.log('ended event', data)
      // window.renderPlayer()
      window.renderAudioButtons()
    })

    this.audio.addEventListener('error', error => {
      console.error('error event', error)
      // window.renderPlayer()
      window.renderAudioButtons()
      // TODO toast an error for playback
    })
  }

  renderPlayButton() {
    return span({}, this.isPlaying ? '⏸' : '▶')
  }

  render(track) {
    // init current track?
    // this.setupEventListeners()

    let currentTime = this.formatTime(this.audio.currentTime)
    let duration = this.formatTime(this.audio.duration)
    console.log('render player', currentTime, duration)

    return div({ class: 'audio-player' },
      div({ class: 'player-controls' },
        button({ 
          id: 'playerPlayButton', 
          class: 'audio-control player-control play-button',
          onclick: () => this.toggle()
        }, 
          this.renderPlayButton()
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
            oninput: (e) => this.setVolume(parseFloat(e.target.value))
          })
        )
      )
    )
  }
}

export default AudioPlayer;
