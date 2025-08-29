// Track detail page logic
document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const trackDetailElement = document.getElementById('trackDetail');
    const commentListElement = document.getElementById('commentList');
    const commentInput = document.getElementById('commentInput');
    const addCommentButton = document.getElementById('addCommentButton');
    const waveform = document.getElementById('waveform');
    const waveformProgress = document.getElementById('waveformProgress');
    
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

    // Initialize the page
    init();

    function init() {
        // Get track ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        const trackId = urlParams.get('id');
        
        if (trackId) {
            const track = mockData.tracks.find(t => t.id === trackId);
            if (track) {
                renderTrackDetail(track);
                renderComments(track);
                setupEventListeners(track);
                
                // Load the track into the player
                currentTrack = track;
                audioPlayer.src = track.audioUrl;
                playerTrackTitle.textContent = track.title;
                
                // Show the player
                fixedPlayer.classList.remove('player-hidden');
                fixedPlayer.classList.add('player-visible');
            } else {
                trackDetailElement.innerHTML = '<p>Track not found</p>';
            }
        } else {
            trackDetailElement.innerHTML = '<p>No track specified</p>';
        }
    }

    // Render track details
    function renderTrackDetail(track) {
        const formattedDate = new Date(track.createdAt).toLocaleDateString();
        
        trackDetailElement.innerHTML = `
            <div class="track-detail-header">
                <div class="track-info">
                    <h1 class="track-title">${track.title}</h1>
                    <p class="track-description">${track.description}</p>
                    <p class="track-meta">Created: ${formattedDate}</p>
                </div>
                <div class="track-actions">
                    <button id="shareButton">
                        <i class="fas fa-share-alt"></i> Share
                    </button>
                    <button class="secondary" id="editButton">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="secondary" id="deleteButton">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `;
    }

    // Render comments
    function renderComments(track) {
        commentListElement.innerHTML = '';
        
        // Sort comments by timestamp if they have one
        const sortedComments = [...track.comments].sort((a, b) => {
            if (a.hasTimestamp && b.hasTimestamp) {
                return a.trackTimestamp - b.trackTimestamp;
            }
            if (a.hasTimestamp) return -1;
            if (b.hasTimestamp) return 1;
            return new Date(b.timestamp) - new Date(a.timestamp);
        });
        
        sortedComments.forEach(comment => {
            const commentElement = document.createElement('div');
            commentElement.className = 'comment';
            
            const formattedDate = new Date(comment.timestamp).toLocaleDateString();
            
            // Format comment text to make timestamp tags clickable
            let commentText = comment.text;
            if (comment.hasTimestamp) {
                const regex = /@(\d{2}):(\d{2})/g;
                commentText = commentText.replace(regex, '<span class="timestamp-tag">@$1:$2</span>');
            }
            
            commentElement.innerHTML = `
                <div class="comment-header">
                    <div class="comment-date">${formattedDate}</div>
                </div>
                <div class="comment-text">${commentText}</div>
                <div class="comment-actions">
                    <button class="secondary edit-comment" data-comment-id="${comment.id}">
                        Edit
                    </button>
                    <button class="secondary delete-comment" data-comment-id="${comment.id}">
                        Delete
                    </button>
                </div>
            `;
            
            commentListElement.appendChild(commentElement);
        });
    }

    // Set up event listeners
    function setupEventListeners(track) {
        // Share button
        const shareButton = document.getElementById('shareButton');
        if (shareButton) {
            shareButton.addEventListener('click', function() {
                const shareableLink = `${window.location.origin}/share/${track.shareableLink}`;
                alert(`Shareable link: ${shareableLink}`);
                // In a real app, this would copy to clipboard or show a modal
            });
        }
        
        // Edit button
        const editButton = document.getElementById('editButton');
        if (editButton) {
            editButton.addEventListener('click', function() {
                // In a real app, this would show an edit form
                alert('Edit functionality would be implemented here');
            });
        }
        
        // Delete button
        const deleteButton = document.getElementById('deleteButton');
        if (deleteButton) {
            deleteButton.addEventListener('click', function() {
                if (confirm('Are you sure you want to delete this track?')) {
                    // In a real app, this would delete the track
                    alert('Delete functionality would be implemented here');
                    window.location.href = 'index.html';
                }
            });
        }
        
        // Add comment button
        addCommentButton.addEventListener('click', function() {
            const commentText = commentInput.value.trim();
            if (commentText) {
                // In a real app, this would save the comment to the server
                alert('Comment added: ' + commentText);
                commentInput.value = '';
                
                // For demo purposes, we'll add it to the UI
                const newComment = {
                    id: 'new-comment-' + Date.now(),
                    text: commentText,
                    timestamp: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    hasTimestamp: commentText.includes('@'),
                    trackTimestamp: null
                };
                
                // Parse timestamp if present
                if (newComment.hasTimestamp) {
                    const match = commentText.match(/@(\d{2}):(\d{2})/);
                    if (match) {
                        const minutes = parseInt(match[1]);
                        const seconds = parseInt(match[2]);
                        newComment.trackTimestamp = minutes * 60 + seconds;
                    }
                }
                
                track.comments.push(newComment);
                renderComments(track);
            }
        });
        
        // Timestamp tag clicks
        commentListElement.addEventListener('click', function(e) {
            if (e.target.classList.contains('timestamp-tag')) {
                const timestampText = e.target.textContent;
                const match = timestampText.match(/@(\d{2}):(\d{2})/);
                if (match) {
                    const minutes = parseInt(match[1]);
                    const seconds = parseInt(match[2]);
                    const timeInSeconds = minutes * 60 + seconds;
                    
                    // Seek to that position
                    audioPlayer.currentTime = timeInSeconds;
                    
                    // Start playing if not already
                    if (!isPlaying) {
                        audioPlayer.play().then(() => {
                            isPlaying = true;
                            playerPlayIcon.className = 'fas fa-pause';
                        }).catch(error => {
                            console.error('Error playing after timestamp click:', error);
                        });
                    }
                }
            }
        });
        
        // Waveform click for seeking
        waveform.addEventListener('click', function(e) {
            const rect = this.getBoundingClientRect();
            const clickPosition = (e.clientX - rect.left) / rect.width;
            
            // Store playing state before seeking
            const wasPlaying = !audioPlayer.paused;
            
            // Set the new time
            const seekTime = audioPlayer.duration * clickPosition;
            audioPlayer.currentTime = seekTime;
            
            // Resume playback if it was playing before
            if (wasPlaying && audioPlayer.paused) {
                audioPlayer.play().catch(error => {
                    console.error('Error resuming playback after waveform seek:', error);
                });
            }
        });
        
        // Fixed player play/pause button
        playerPlayButton.addEventListener('click', togglePlayPause);
        
        // Progress bar click for seeking
        playerProgressBar.addEventListener('click', function(e) {
            const rect = this.getBoundingClientRect();
            const clickPosition = (e.clientX - rect.left) / rect.width;
            
            // Store playing state before seeking
            const wasPlaying = !audioPlayer.paused;
            
            // Set the new time
            const seekTime = audioPlayer.duration * clickPosition;
            audioPlayer.currentTime = seekTime;
            
            // Resume playback if it was playing before
            if (wasPlaying && audioPlayer.paused) {
                audioPlayer.play().catch(error => {
                    console.error('Error resuming playback after seek:', error);
                });
            }
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
        audioPlayer.addEventListener('timeupdate', function() {
            updateProgress();
            updateWaveformProgress();
        });
        
        audioPlayer.addEventListener('ended', function() {
            isPlaying = false;
            playerPlayIcon.className = 'fas fa-play';
        });
    }

    // Toggle play/pause
    function togglePlayPause() {
        if (isPlaying) {
            audioPlayer.pause();
            isPlaying = false;
            playerPlayIcon.className = 'fas fa-play';
        } else {
            audioPlayer.play().then(() => {
                isPlaying = true;
                playerPlayIcon.className = 'fas fa-pause';
            }).catch(error => {
                console.error('Error toggling playback:', error);
            });
        }
    }

    // Update progress bar and time display
    function updateProgress() {
        const currentTime = audioPlayer.currentTime;
        const duration = audioPlayer.duration;
        const progressPercent = (currentTime / duration) * 100;
        
        playerProgressFill.style.width = `${progressPercent}%`;
        playerTimeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
    }
    
    // Update waveform progress
    function updateWaveformProgress() {
        const currentTime = audioPlayer.currentTime;
        const duration = audioPlayer.duration;
        const progressPercent = (currentTime / duration) * 100;
        
        waveformProgress.style.width = `${progressPercent}%`;
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
