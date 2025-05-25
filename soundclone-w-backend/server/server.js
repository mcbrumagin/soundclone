const express = require('express');
const fileUpload = require('express-fileupload');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Create data directories if they don't exist
const dataDir = path.join(__dirname, 'data');
const uploadsDir = path.join(dataDir, 'uploads');
const metadataDir = path.join(dataDir, 'metadata');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
if (!fs.existsSync(metadataDir)) {
  fs.mkdirSync(metadataDir);
}

// Configure middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(fileUpload({
  createParentPath: true,
  limits: { 
    fileSize: 50 * 1024 * 1024 // 50MB max file size
  },
  abortOnLimit: true
}));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '..', 'public')));

// API Routes
app.get('/api/tracks', (req, res) => {
  try {
    // Read track metadata files
    const files = fs.readdirSync(metadataDir);
    const tracks = [];
    
    files.forEach(file => {
      if (file.endsWith('.json')) {
        const trackData = JSON.parse(fs.readFileSync(path.join(metadataDir, file), 'utf8'));
        tracks.push(trackData);
      }
    });
    
    // Sort tracks by creation date (newest first)
    tracks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json({ success: true, tracks });
  } catch (err) {
    console.error('Error fetching tracks:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch tracks' });
  }
});

app.get('/api/tracks/:id', (req, res) => {
  try {
    const trackId = req.params.id;
    const trackPath = path.join(metadataDir, `${trackId}.json`);
    
    if (!fs.existsSync(trackPath)) {
      return res.status(404).json({ success: false, message: 'Track not found' });
    }
    
    const trackData = JSON.parse(fs.readFileSync(trackPath, 'utf8'));
    res.json({ success: true, track: trackData });
  } catch (err) {
    console.error('Error fetching track:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch track' });
  }
});

app.post('/api/tracks', (req, res) => {
  try {
    if (!req.files || !req.files.audio) {
      return res.status(400).json({ success: false, message: 'No audio file uploaded' });
    }
    
    const audioFile = req.files.audio;
    const { title, description } = req.body;
    
    if (!title) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }
    
    // Generate a unique ID for the track
    const trackId = uuidv4();
    const fileExtension = path.extname(audioFile.name);
    const fileName = `${trackId}${fileExtension}`;
    const filePath = path.join(uploadsDir, fileName);
    
    // Move the uploaded file to the uploads directory
    audioFile.mv(filePath, async (err) => {
      if (err) {
        console.error('Error saving file:', err);
        return res.status(500).json({ success: false, message: 'Failed to save file' });
      }
      
      // Create track metadata
      const trackData = {
        id: trackId,
        title,
        description: description || '',
        fileName,
        fileType: audioFile.mimetype,
        fileSize: audioFile.size,
        duration: 0, // This would be calculated in a real app
        audioUrl: `/api/audio/${trackId}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        shareableLink: trackId,
        comments: []
      };
      
      // Save track metadata
      fs.writeFileSync(path.join(metadataDir, `${trackId}.json`), JSON.stringify(trackData, null, 2));
      
      res.status(201).json({ success: true, track: trackData });
    });
  } catch (err) {
    console.error('Error uploading track:', err);
    res.status(500).json({ success: false, message: 'Failed to upload track' });
  }
});

app.put('/api/tracks/:id', (req, res) => {
  try {
    const trackId = req.params.id;
    const trackPath = path.join(metadataDir, `${trackId}.json`);
    
    if (!fs.existsSync(trackPath)) {
      return res.status(404).json({ success: false, message: 'Track not found' });
    }
    
    const trackData = JSON.parse(fs.readFileSync(trackPath, 'utf8'));
    const { title, description } = req.body;
    
    // Update track metadata
    if (title) trackData.title = title;
    if (description !== undefined) trackData.description = description;
    trackData.updatedAt = new Date().toISOString();
    
    // Save updated track metadata
    fs.writeFileSync(trackPath, JSON.stringify(trackData, null, 2));
    
    res.json({ success: true, track: trackData });
  } catch (err) {
    console.error('Error updating track:', err);
    res.status(500).json({ success: false, message: 'Failed to update track' });
  }
});

app.delete('/api/tracks/:id', (req, res) => {
  try {
    const trackId = req.params.id;
    const trackPath = path.join(metadataDir, `${trackId}.json`);
    
    if (!fs.existsSync(trackPath)) {
      return res.status(404).json({ success: false, message: 'Track not found' });
    }
    
    // Read track data to get the file name
    const trackData = JSON.parse(fs.readFileSync(trackPath, 'utf8'));
    const filePath = path.join(uploadsDir, trackData.fileName);
    
    // Delete the audio file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    // Delete the metadata file
    fs.unlinkSync(trackPath);
    
    res.json({ success: true, message: 'Track deleted successfully' });
  } catch (err) {
    console.error('Error deleting track:', err);
    res.status(500).json({ success: false, message: 'Failed to delete track' });
  }
});

// Comments API
app.post('/api/tracks/:id/comments', (req, res) => {
  try {
    const trackId = req.params.id;
    const trackPath = path.join(metadataDir, `${trackId}.json`);
    
    if (!fs.existsSync(trackPath)) {
      return res.status(404).json({ success: false, message: 'Track not found' });
    }
    
    const trackData = JSON.parse(fs.readFileSync(trackPath, 'utf8'));
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ success: false, message: 'Comment text is required' });
    }
    
    // Create new comment
    const commentId = uuidv4();
    const hasTimestamp = text.includes('@');
    let trackTimestamp = null;
    
    // Parse timestamp if present
    if (hasTimestamp) {
      const match = text.match(/@(\d{2}):(\d{2})/);
      if (match) {
        const minutes = parseInt(match[1]);
        const seconds = parseInt(match[2]);
        trackTimestamp = minutes * 60 + seconds;
      }
    }
    
    const comment = {
      id: commentId,
      text,
      timestamp: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      hasTimestamp,
      trackTimestamp
    };
    
    // Add comment to track
    trackData.comments.push(comment);
    trackData.updatedAt = new Date().toISOString();
    
    // Save updated track metadata
    fs.writeFileSync(trackPath, JSON.stringify(trackData, null, 2));
    
    res.status(201).json({ success: true, comment });
  } catch (err) {
    console.error('Error adding comment:', err);
    res.status(500).json({ success: false, message: 'Failed to add comment' });
  }
});

app.put('/api/tracks/:trackId/comments/:commentId', (req, res) => {
  try {
    const { trackId, commentId } = req.params;
    const trackPath = path.join(metadataDir, `${trackId}.json`);
    
    if (!fs.existsSync(trackPath)) {
      return res.status(404).json({ success: false, message: 'Track not found' });
    }
    
    const trackData = JSON.parse(fs.readFileSync(trackPath, 'utf8'));
    const commentIndex = trackData.comments.findIndex(c => c.id === commentId);
    
    if (commentIndex === -1) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }
    
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ success: false, message: 'Comment text is required' });
    }
    
    // Update comment
    const hasTimestamp = text.includes('@');
    let trackTimestamp = null;
    
    // Parse timestamp if present
    if (hasTimestamp) {
      const match = text.match(/@(\d{2}):(\d{2})/);
      if (match) {
        const minutes = parseInt(match[1]);
        const seconds = parseInt(match[2]);
        trackTimestamp = minutes * 60 + seconds;
      }
    }
    
    trackData.comments[commentIndex].text = text;
    trackData.comments[commentIndex].updatedAt = new Date().toISOString();
    trackData.comments[commentIndex].hasTimestamp = hasTimestamp;
    trackData.comments[commentIndex].trackTimestamp = trackTimestamp;
    
    trackData.updatedAt = new Date().toISOString();
    
    // Save updated track metadata
    fs.writeFileSync(trackPath, JSON.stringify(trackData, null, 2));
    
    res.json({ success: true, comment: trackData.comments[commentIndex] });
  } catch (err) {
    console.error('Error updating comment:', err);
    res.status(500).json({ success: false, message: 'Failed to update comment' });
  }
});

app.delete('/api/tracks/:trackId/comments/:commentId', (req, res) => {
  try {
    const { trackId, commentId } = req.params;
    const trackPath = path.join(metadataDir, `${trackId}.json`);
    
    if (!fs.existsSync(trackPath)) {
      return res.status(404).json({ success: false, message: 'Track not found' });
    }
    
    const trackData = JSON.parse(fs.readFileSync(trackPath, 'utf8'));
    const commentIndex = trackData.comments.findIndex(c => c.id === commentId);
    
    if (commentIndex === -1) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }
    
    // Remove comment
    trackData.comments.splice(commentIndex, 1);
    trackData.updatedAt = new Date().toISOString();
    
    // Save updated track metadata
    fs.writeFileSync(trackPath, JSON.stringify(trackData, null, 2));
    
    res.json({ success: true, message: 'Comment deleted successfully' });
  } catch (err) {
    console.error('Error deleting comment:', err);
    res.status(500).json({ success: false, message: 'Failed to delete comment' });
  }
});

// Serve audio files
app.get('/api/audio/:id', (req, res) => {
  try {
    const trackId = req.params.id;
    const trackPath = path.join(metadataDir, `${trackId}.json`);
    
    if (!fs.existsSync(trackPath)) {
      return res.status(404).json({ success: false, message: 'Track not found' });
    }
    
    const trackData = JSON.parse(fs.readFileSync(trackPath, 'utf8'));
    const filePath = path.join(uploadsDir, trackData.fileName);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Audio file not found' });
    }
    
    res.setHeader('Content-Type', trackData.fileType);
    res.setHeader('Content-Disposition', `inline; filename="${trackData.fileName}"`);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (err) {
    console.error('Error streaming audio:', err);
    res.status(500).json({ success: false, message: 'Failed to stream audio' });
  }
});

// Handle 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
