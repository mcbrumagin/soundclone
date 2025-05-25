// Upload page logic
document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const dropArea = document.getElementById('dropArea');
    const fileInput = document.getElementById('fileInput');
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const fileSize = document.getElementById('fileSize');
    const titleInput = document.getElementById('titleInput');
    const descriptionInput = document.getElementById('descriptionInput');
    const uploadButton = document.getElementById('uploadButton');
    
    // Player elements (same as in app.js)
    const audioPlayer = document.getElementById('audioPlayer');
    const fixedPlayer = document.getElementById('fixedPlayer');
    const playerPlayButton = document.getElementById('playerPlayButton');
    const playerPlayIcon = document.getElementById('playerPlayIcon');
    const playerTrackTitle = document.getElementById('playerTrackTitle');
    const playerProgressBar = document.getElementById('playerProgressBar');
    const playerProgressFill = document.getElementById('playerProgressFill');
    const playerTimeDisplay = document.getElementById('playerTimeDisplay');
    const volumeSlider = document.getElementById('volumeSlider');
    const volumeIcon = document.getElementById('volumeIcon');

    // Current track state
    let currentTrack = null;
    let isPlaying = false;
    let selectedFile = null;

    // Initialize the page
    init();

    function init() {
        setupEventListeners();
    }

    // Set up event listeners
    function setupEventListeners() {
        // File drop area
        dropArea.addEventListener('click', function() {
            fileInput.click();
        });
        
        dropArea.addEventListener('dragover', function(e) {
            e.preventDefault();
            dropArea.classList.add('dragover');
        });
        
        dropArea.addEventListener('dragleave', function() {
            dropArea.classList.remove('dragover');
        });
        
        dropArea.addEventListener('drop', function(e) {
            e.preventDefault();
            dropArea.classList.remove('dragover');
            
            if (e.dataTransfer.files.length) {
                handleFileSelect(e.dataTransfer.files[0]);
            }
        });
        
        // File input change
        fileInput.addEventListener('change', function() {
            if (this.files.length) {
                handleFileSelect(this.files[0]);
            }
        });
        
        // Upload button
        uploadButton.addEventListener('click', function() {
            if (!selectedFile) {
                alert('Please select a file to upload');
                return;
            }
            
            const title = titleInput.value.trim();
            if (!title) {
                alert('Please enter a title for your track');
                return;
            }
            
            // In a real app, this would upload the file to the server
            alert(`File "${selectedFile.name}" would be uploaded with title: ${title}`);
            
            // For demo purposes, redirect to home page
            window.location.href = 'index.html';
        });
        
        // Fixed player play/pause button
        playerPlayButton.addEventListener('click', togglePlayPause);
        
        // Progress bar click for seeking
        playerProgressBar.addEventListener('click', function(e) {
            if (!currentTrack) return;
            
            const rect = this.getBoundingClientRect();
            const clickPosition = (e.clientX - rect.left) / rect.width;
            const seekTime = audioPlayer.duration * clickPosition;
            
            audioPlayer.currentTime = seekTime;
        });
        
        // Volume slider
        volumeSlider.addEventListener('input', function() {
            audioPlayer.volume = this.value;
            updateVolumeIcon(this.value);
        });
        
        // Volume icon click to mute/unmute
        volumeIcon.addEventListener('click', function() {
            if (audioPlayer.volume > 0) {
                audioPlayer.volume = 0;
                volumeSlider.value = 0;
            } else {
                audioPlayer.volume = 1;
                volumeSlider.value = 1;
            }
            updateVolumeIcon(audioPlayer.volume);
        });
        
        // Audio player events
        audioPlayer.addEventListener('timeupdate', updateProgress);
        audioPlayer.addEventListener('ended', function() {
            isPlaying = false;
            playerPlayIcon.className = 'fas fa-play';
        });
    }

    // Handle file selection
    function handleFileSelect(file) {
        // Check if file is audio
        if (!file.type.match('audio/(mp3|wav)')) {
            alert('Please select an MP3 or WAV file');
            return;
        }
        
        selectedFile = file;
        
        // Update file info
        fileName.textContent = file.name;
        fileSize.textContent = (file.size / 1024).toFixed(2);
        fileInfo.style.display = 'block';
        
        // Auto-fill title from filename
        const titleFromFile = file.name.replace(/\.(mp3|wav)$/i, '').replace(/_/g, ' ');
        titleInput.value = titleFromFile;
        
        // Preview the audio
        const fileURL = URL.createObjectURL(file);
        audioPlayer.src = fileURL;
        
        // Update player
        currentTrack = {
            title: titleFromFile,
            duration: 0 // Will be updated when metadata is loaded
        };
        
        playerTrackTitle.textContent = titleFromFile;
        
        // Show the player
        fixedPlayer.classList.remove('player-hidden');
        fixedPlayer.classList.add('player-visible');
        
        // Get duration when metadata is loaded
        audioPlayer.addEventListener('loadedmetadata', function() {
            currentTrack.duration = audioPlayer.duration;
        });
    }

    // Toggle play/pause
    function togglePlayPause() {
        if (!currentTrack) return;
        
        if (isPlaying) {
            audioPlayer.pause();
            isPlaying = false;
            playerPlayIcon.className = 'fas fa-play';
        } else {
            audioPlayer.play();
            isPlaying = true;
            playerPlayIcon.className = 'fas fa-pause';
        }
    }

    // Update progress bar and time display
    function updateProgress() {
        if (!currentTrack) return;
        
        const currentTime = audioPlayer.currentTime;
        const duration = audioPlayer.duration;
        const progressPercent = (currentTime / duration) * 100;
        
        playerProgressFill.style.width = `${progressPercent}%`;
        playerTimeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
    }

    // Update volume icon based on volume level
    function updateVolumeIcon(volume) {
        if (volume === 0) {
            volumeIcon.className = 'fas fa-volume-mute volume-icon';
        } else if (volume < 0.5) {
            volumeIcon.className = 'fas fa-volume-down volume-icon';
        } else {
            volumeIcon.className = 'fas fa-volume-up volume-icon';
        }
    }

    // Format seconds to mm:ss
    function formatTime(seconds) {
        seconds = Math.floor(seconds || 0);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
});
