class PlayerComponent {
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

    this.player.on('play', () => {
      this.updatePlayButton(true);
    });

    this.player.on('pause', () => {
      this.updatePlayButton(false);
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
    // Update progress slider
    if (this.elements.progressSlider && duration) {
      const progress = (currentTime / duration) * 100;
      this.elements.progressSlider.value = progress || 0;
    }
    
    // Update time display
    if (this.elements.timeDisplay) {
      const current = this.formatTime(currentTime || 0);
      const total = this.formatTime(duration || 0);
      this.elements.timeDisplay.textContent = `${current} / ${total}`;
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
    
    // Update time display to show total duration
    if (this.elements.timeDisplay && duration) {
      this.elements.timeDisplay.textContent = `0:00 / ${this.formatTime(duration)}`;
    }
  }

  formatTime(seconds) {
    if (!seconds || isNaN(seconds) || !isFinite(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }


}

export default PlayerComponent;
