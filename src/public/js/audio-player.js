import { htmlTags } from 'micro-js-html'
import { getAudioMetadata } from './api.js'
const { div, input, button, span } = htmlTags

class AudioPlayer {
  constructor() {
    this.audio = new Audio()
    this.currentTrack = { id: 'N/A' }
    this.volume = 1
    
    this.setupEventListeners()
  }

  async loadTrack(track) {
    if (!track) track = appState.tracks[0]
    console.log('loadTrack into player', track)
    this.currentTrack = track

    // Support both fileName (uploaded files) and audioUrl (recorded audio)
    let audioSrc
    if (track.fileName) {
      audioSrc = `/api/audio/${track.fileName}`
      
      // Fetch real duration from server if not already available
      if (!track.realDuration && track.fileName) {
        try {
          console.log('Fetching audio metadata for:', track.fileName)
          const metadataResponse = await getAudioMetadata(track.fileName)
          if (metadataResponse.success && metadataResponse.metadata) {
            track.realDuration = metadataResponse.metadata.duration
            track.audioMetadata = metadataResponse.metadata
            console.log('Got audio metadata:', metadataResponse.metadata)
            
            // Update the track in appState if it exists there
            const appTrack = appState.tracks?.find(t => t.id === track.id)
            if (appTrack) {
              appTrack.realDuration = track.realDuration
              appTrack.audioMetadata = track.audioMetadata
            }
          }
        } catch (error) {
          console.error('Failed to fetch audio metadata:', error)
          // Don't let metadata failure prevent audio loading
        }
      }
    } else if (track.audioUrl) {
      audioSrc = track.audioUrl
    } else {
      console.error('Track has neither fileName nor audioUrl:', track)
      return
    }
    
    this.audio.src = audioSrc
    console.log('Loading audio from:', audioSrc, {track})
    console.log('Browser audio support check:', {
      canPlayWav: this.audio.canPlayType('audio/wav'),
      canPlayMp3: this.audio.canPlayType('audio/mpeg'),
      canPlayWebm: this.audio.canPlayType('audio/webm')
    })
    
    // Reset audio element state
    await this.audio.load()
    
    // Add a load event listener to track loading progress
    // const onLoadStart = () => {
    //   console.log('Audio load started')
    //   this.audio.removeEventListener('loadstart', onLoadStart)
    // }
    // this.audio.addEventListener('loadstart', onLoadStart, { once: true })
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
    
    try {
      // Wait for the audio to be ready before playing
      // if (this.audio.readyState < 2) {
        console.log('Audio not ready, waiting for canplay event...')
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Audio load timeout'))
          }, 10000) // 10 second timeout
          
          const onCanPlay = () => {
            clearTimeout(timeout)
            this.audio.removeEventListener('canplay', onCanPlay)
            this.audio.removeEventListener('error', onError)
            resolve()
          }
          
          const onError = (e) => {
            clearTimeout(timeout)
            this.audio.removeEventListener('canplay', onCanPlay)
            this.audio.removeEventListener('error', onError)
            reject(new Error(`Audio load failed: ${e.message || 'Unknown error'}`))
          }
          
          this.audio.addEventListener('canplay', onCanPlay, { once: true })
          this.audio.addEventListener('error', onError, { once: true })
          this.audio.load()
          console.log('Audio load started')
        })
      // }
      
      await this.audio.play()
      return true
    } catch (error) {
      console.error('Play failed:', error)
      // Try to provide more specific error information
      if (error.name === 'NotSupportedError') {
        console.error('Audio format not supported by browser. File:', this.audio.src)
        console.error('Current track:', this.currentTrack)
      }
      throw error
    }
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
    // Use realDuration if available, fallback to duration, then audio.duration
    const duration = this.currentTrack.realDuration || this.currentTrack.duration || this.audio.duration
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
      console.error('Audio error event:', error)
      console.error('Audio error details:', {
        error: this.audio.error,
        networkState: this.audio.networkState,
        readyState: this.audio.readyState,
        src: this.audio.src,
        currentTrack: this.currentTrack
      })
      
      // Log more specific error information
      if (this.audio.error) {
        const errorCodes = {
          1: 'MEDIA_ERR_ABORTED - The user aborted the loading process',
          2: 'MEDIA_ERR_NETWORK - A network error occurred while loading',
          3: 'MEDIA_ERR_DECODE - An error occurred while decoding the media',
          4: 'MEDIA_ERR_SRC_NOT_SUPPORTED - The media format is not supported'
        }
        console.error('Audio error code:', this.audio.error.code, '-', errorCodes[this.audio.error.code])
      }
      
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
    // Use realDuration if available, fallback to duration, then audio.duration
    const realDuration = this.currentTrack.realDuration || this.currentTrack.duration || this.audio.duration
    let duration = this.formatTime(realDuration)
    console.log('render player', currentTime, duration, 'realDuration:', realDuration)

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
              const duration = this.currentTrack.realDuration || this.currentTrack.duration || this.audio.duration
              if (this.currentTrack && duration) {
                const seekTime = (parseFloat(e.target.value) / 100) * duration
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
