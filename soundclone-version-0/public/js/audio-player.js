// Audio Player System - Clean, modular design

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
      return true;
    } catch (error) {
      console.error('Playback failed:', error);
      return false;
    }
  }

  pause() {
    this.audio.pause();
    this.isPlaying = false;
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
}

class PlayerUI {
  constructor(player, elements) {
    this.player = player;
    this.elements = elements; // { playButton, progressSlider, timeDisplay, etc. }
    
    this.setupUI();
    this.bindPlayerEvents();
  }

  setupUI() {
    // Play button
    if (this.elements.playButton) {
      this.elements.playButton.addEventListener('click', () => {
        this.player.toggle();
      });
    }

    // Progress slider
    if (this.elements.progressSlider) {
      this.elements.progressSlider.addEventListener('input', (e) => {
        const seekTime = (e.target.value / 100) * this.player.audio.duration;
        this.player.seek(seekTime);
      });
    }

    // Volume slider
    if (this.elements.volumeSlider) {
      this.elements.volumeSlider.addEventListener('input', (e) => {
        this.player.setVolume(e.target.value);
      });
    }
  }

  bindPlayerEvents() {
    this.player.on('timeupdate', (data) => {
      this.updateProgress(data);
    });

    this.player.on('loaded', (data) => {
      this.updateDuration(data.duration);
    });

    this.player.on('ended', () => {
      this.updatePlayButton(false);
    });

    this.player.on('error', (error) => {
      console.error('Player UI error:', error);
      this.updatePlayButton(false);
    });
  }

  updateProgress({ currentTime, duration }) {
    if (this.elements.progressSlider) {
      const progress = (currentTime / duration) * 100;
      this.elements.progressSlider.value = progress;
    }
    
    if (this.elements.timeDisplay) {
      this.elements.timeDisplay.textContent = 
        `${this.formatTime(currentTime)} / ${this.formatTime(duration)}`;
    }
  }

  updatePlayButton(isPlaying) {
    if (this.elements.playButton) {
      const icon = this.elements.playButton.querySelector('span');
      if (icon) {
        icon.textContent = isPlaying ? '⏸' : '▶';
      }
    }
  }

  updateDuration(duration) {
    if (this.elements.progressSlider) {
      this.elements.progressSlider.max = 100;
    }
  }

  formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}

class TrackManager {
  constructor(player) {
    this.player = player;
    this.tracks = [];
  }

  async loadTracks() {
    try {
      const response = await fetch('/api/tracks');
      const data = await response.json();
      this.tracks = data.tracks || [];
      return this.tracks;
    } catch (error) {
      console.error('Failed to load tracks:', error);
      return [];
    }
  }

  playTrack(trackId) {
    const track = this.tracks.find(t => t.id === trackId);
    if (track) {
      console.log('Playing track:', track);
      this.player.loadTrack(track);
      return this.player.play();
    }
    console.error('Track not found:', trackId);
    return false;
  }

  getTrack(trackId) {
    return this.tracks.find(t => t.id === trackId);
  }
}

// Export for use in other modules
window.AudioPlayer = AudioPlayer;
window.PlayerUI = PlayerUI;
window.TrackManager = TrackManager;
