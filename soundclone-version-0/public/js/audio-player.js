import { tags } from 'micro-js-html'
const { div, input, button, span } = tags

class AudioPlayer {
  constructor() {
    this.audio = new Audio();
    this.currentTrack = null;
    this.isPlaying = false;
    this.volume = 1;
    this.listeners = {};
    
    this.setupEventListeners();
  }

  loadTrack(track) {
    this.currentTrack = track;
    // Construct the audio URL using the server's API endpoint
    this.audio.src = `/api/audio/${track.id}`;
    console.log('Loading audio from:', this.audio.src)
    this.audio.load();
  }

  async play() {
    if (!this.currentTrack) return false;
    
    try {
      await this.audio.play();
      this.isPlaying = true;
      this.emit('play');
      return true;
    } catch (error) {
      console.error('Playback failed:', error);
      return false;
    }
  }

  pause() {
    this.audio.pause();
    this.isPlaying = false;
    this.emit('pause');
  }

  toggle() {
    return this.isPlaying ? this.pause() : this.play();
  }

  seek(time) {
    this.audio.currentTime = time;
  }

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    this.audio.volume = this.volume;
  }

  setupEventListeners() {
    this.audio.addEventListener('timeupdate', () => {
      this.emit('timeupdate', {
        currentTime: this.audio.currentTime,
        duration: this.audio.duration
      });
    });

    this.audio.addEventListener('ended', () => {
      this.isPlaying = false;
      this.emit('ended');
    });

    this.audio.addEventListener('loadedmetadata', () => {
      this.emit('loaded', {
        duration: this.audio.duration
      });
    });

    this.audio.addEventListener('error', (error) => {
      console.error('Audio error:', error);
      this.emit('error', error);
    });
  }

  // Simple event emitter
  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }

  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  updatePlayer() {
    if (window.audioSystem && window.audioSystem.playerUI) {
      const playerElements = {
        playButton: document.getElementById('playerPlayButton'),
        progressSlider: document.getElementById('playerProgressSlider'),
        timeDisplay: document.getElementById('playerTimeDisplay'),
        volumeSlider: document.getElementById('volumeSlider')
      };
      
      // Update the PlayerUI elements reference
      if (Object.values(playerElements).some(el => el)) {
        window.audioSystem.playerUI.elements = playerElements
      }
    }
    
    // Update play button state without full re-render
    const playButton = document.getElementById('playerPlayButton')
    if (playButton) {
      const icon = playButton.querySelector('span')
      if (icon) {
        icon.textContent = appState.isPlaying ? '⏸' : '▶'
      }
    }
  }

  render() {
    setTimeout(this.updatePlayer, 0) // TODO this is ugly

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
                const duration = window.audioSystem.player.audio.duration
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
