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
      console.log('Tracks loaded:', this.tracks);
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

export default TrackManager;
