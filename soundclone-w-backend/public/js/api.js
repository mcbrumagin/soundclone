// API service for SoundClone
const API_URL = '/api'; // http://localhost:3000

class ApiService {
  // Fetch all tracks
  static async getTracks() {
    try {
      const response = await fetch(`${API_URL}/tracks`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch tracks');
      }
      
      return data.tracks;
    } catch (error) {
      console.error('Error fetching tracks:', error);
      throw error;
    }
  }
  
  // Fetch a single track by ID
  static async getTrack(trackId) {
    try {
      const response = await fetch(`${API_URL}/tracks/${trackId}`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch track');
      }
      
      return data.track;
    } catch (error) {
      console.error(`Error fetching track ${trackId}:`, error);
      throw error;
    }
  }
  
  // Upload a new track
  static async uploadTrack(formData) {
    try {
      const response = await fetch(`${API_URL}/tracks`, {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to upload track');
      }
      
      return data.track;
    } catch (error) {
      console.error('Error uploading track:', error);
      throw error;
    }
  }
  
  // Update track details
  static async updateTrack(trackId, updates) {
    try {
      const response = await fetch(`${API_URL}/tracks/${trackId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to update track');
      }
      
      return data.track;
    } catch (error) {
      console.error(`Error updating track ${trackId}:`, error);
      throw error;
    }
  }
  
  // Delete a track
  static async deleteTrack(trackId) {
    try {
      const response = await fetch(`${API_URL}/tracks/${trackId}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to delete track');
      }
      
      return true;
    } catch (error) {
      console.error(`Error deleting track ${trackId}:`, error);
      throw error;
    }
  }
  
  // Add a comment to a track
  static async addComment(trackId, text) {
    try {
      const response = await fetch(`${API_URL}/tracks/${trackId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text })
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to add comment');
      }
      
      return data.comment;
    } catch (error) {
      console.error(`Error adding comment to track ${trackId}:`, error);
      throw error;
    }
  }
  
  // Update a comment
  static async updateComment(trackId, commentId, text) {
    try {
      const response = await fetch(`${API_URL}/tracks/${trackId}/comments/${commentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text })
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to update comment');
      }
      
      return data.comment;
    } catch (error) {
      console.error(`Error updating comment ${commentId}:`, error);
      throw error;
    }
  }
  
  // Delete a comment
  static async deleteComment(trackId, commentId) {
    try {
      const response = await fetch(`${API_URL}/tracks/${trackId}/comments/${commentId}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to delete comment');
      }
      
      return true;
    } catch (error) {
      console.error(`Error deleting comment ${commentId}:`, error);
      throw error;
    }
  }
  
  // Get audio URL for a track
  static getAudioUrl(trackId) {
    return `${API_URL}/audio/${trackId}`;
  }
}
