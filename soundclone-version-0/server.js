const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

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

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve node_modules with correct MIME types for ES modules
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

// Serve local micro-js-html repo with correct MIME types
app.get('/local/micro-js-html/src/*', (req, res) => {
  const filePath = path.join(__dirname, '..', 'micro-js-html', 'src', req.params[0]);
  if (filePath.endsWith('.js')) {
    res.setHeader('Content-Type', 'application/javascript');
  }
  console.log({filePath})
  res.sendFile(filePath);
});

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

    console.log({trackPath})
    
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

// Serve audio files
app.get('/api/audio/:id', (req, res) => {
  try {
    const trackId = req.params.id;
    const trackPath = path.join(metadataDir, `${trackId}.json`);

    console.log({trackPath})
    
    if (!fs.existsSync(trackPath)) {
      return res.status(404).json({ success: false, message: 'Track not found' });
    }
    
    const trackData = JSON.parse(fs.readFileSync(trackPath, 'utf8'));
    const audioPath = path.join(uploadsDir, trackData.fileName);

    console.log({audioPath})
    
    if (!fs.existsSync(audioPath)) {
      return res.status(404).json({ success: false, message: 'Audio file not found' });
    }
    
    res.sendFile(audioPath);
  } catch (err) {
    console.error('Error serving audio:', err);
    res.status(500).json({ success: false, message: 'Failed to serve audio' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'SoundClone v0 server is running',
    timestamp: new Date().toISOString()
  });
});

// Serve index.html for all other routes (SPA routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`SoundClone v0 server running on http://localhost:${PORT}`);
  console.log(`API health check: http://localhost:${PORT}/api/health`);
});

