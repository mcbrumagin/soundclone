// Main application logic for SoundClone SPA
document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements - Global
    const audioPlayer = document.getElementById('audioPlayer');
    const fixedPlayer = document.getElementById('fixedPlayer');
    const playerPlayButton = document.getElementById('playerPlayButton');
    const playerPlayIcon = document.getElementById('playerPlayIcon');
    const playerTrackTitle = document.getElementById('playerTrackTitle');
    const playerProgressSlider = document.getElementById('playerProgressSlider');
    const playerTimeDisplay = document.getElementById('playerTimeDisplay');
    const volumeSlider = document.getElementById('volumeSlider');
    const volumeIcon = document.getElementById('volumeIcon');
    
    // DOM Elements - Views
    const viewContainer = document.getElementById('view-container');
    const views = document.querySelectorAll('.view');
    
    // DOM Elements - Home View
    const trackListElement = document.getElementById('trackList');
    
    // DOM Elements - Track Detail View
    const trackDetailElement = document.getElementById('trackDetail');
    const commentListElement = document.getElementById('commentList');
    const commentInput = document.getElementById('commentInput');
    const addCommentButton = document.getElementById('addCommentButton');
    const waveform = document.getElementById('waveform');
    const waveformProgress = document.getElementById('waveformProgress');
    const waveformSeeker = document.getElementById('waveformSeeker');
    
    // DOM Elements - Upload View
    const dropArea = document.getElementById('dropArea');
    const fileInput = document.getElementById('fileInput');
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const fileSize = document.getElementById('fileSize');
    const uploadTitleInput = document.getElementById('uploadTitleInput');
    const uploadDescriptionInput = document.getElementById('uploadDescriptionInput');
    const uploadButton = document.getElementById('uploadButton');
    
    // DOM Elements - Record View
    const recordButton = document.getElementById('recordButton');
    const recordTimer = document.getElementById('recordTimer');
    const audioLevel = document.getElementById('audioLevel');
    const playButton = document.getElementById('playButton');
    const resetButton = document.getElementById('resetButton');
    const recordTitleInput = document.getElementById('recordTitleInput');
    const recordDescriptionInput = document.getElementById('recordDescriptionInput');
    const saveButton = document.getElementById('saveButton');
    const discardButton = document.getElementById('discardButton');

    // Application State
    const appState = {
        currentView: 'home',
        currentTrack: null,
        isPlaying: false,
        currentTrackId: null,
        seekingInProgress: false,
        userSeekedTo: null,
        // Recording state
        mediaRecorder: null,
        audioChunks: [],
        recordingStartTime: 0,
        recordingTimer: null,
        recordingBlob: null,
        recordingUrl: null,
        isRecording: false,
        // Upload state
        selectedFile: null
    };

    // Initialize the application
    init();

    function init() {
        setupRouting();
        renderTrackList();
        setupEventListeners();
        
        // Check if there's a hash in the URL to determine initial view
        const hash = window.location.hash;
        if (hash) {
            const parts = hash.substring(1).split('/');
            if (parts.length > 0) {
                const view = parts[0];
                if (view === 'track-detail' && parts.length > 1) {
                    appState.currentTrackId = parts[1];
                    navigateToView('track-detail');
                } else {
                    navigateToView(view);
                }
            } else {
                navigateToView('home');
            }
        } else {
            navigateToView('home');
        }
    }

    // Set up client-side routing
    function setupRouting() {
        // Navigation links
        document.querySelectorAll('[data-view]').forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const view = this.getAttribute('data-view');
                
                // If navigating to track detail, we need a track ID
                if (view === 'track-detail' && !this.hasAttribute('data-track-id')) {
                    return;
                }
                
                // If we have a track ID, store it
                if (this.hasAttribute('data-track-id')) {
                    appState.currentTrackId = this.getAttribute('data-track-id');
                }
                
                navigateToView(view);
            });
        });
        
        // Handle browser back/forward buttons
        window.addEventListener('popstate', function(e) {
            if (e.state && e.state.view) {
                navigateToView(e.state.view, false);
                if (e.state.trackId) {
                    appState.currentTrackId = e.state.trackId;
                    loadTrackDetails(appState.currentTrackId);
                }
            }
        });
    }

    // Navigate to a specific view
    function navigateToView(viewName, pushState = true) {
        // Hide all views
        views.forEach(view => {
            view.classList.remove('active-view');
        });
        
        // Show the requested view
        const targetView = document.getElementById(viewName + '-view');
        if (targetView) {
            targetView.classList.add('active-view');
            appState.currentView = viewName;
            
            // Update browser history and URL
            if (pushState) {
                const state = { view: viewName };
                let url = '#' + viewName;
                
                if (viewName === 'track-detail' && appState.currentTrackId) {
                    state.trackId = appState.currentTrackId;
                    url = '#track-detail/' + appState.currentTrackId;
                }
                
                window.history.pushState(state, '', url);
            }
            
            // Perform view-specific initialization
            if (viewName === 'track-detail' && appState.currentTrackId) {
                loadTrackDetails(appState.currentTrackId);
            }
        }
    }

    // Render the list of tracks from mock data
    function renderTrackList() {
        trackListElement.innerHTML = '';
        
        mockData.tracks.forEach(track => {
            const trackCard = document.createElement('div');
            trackCard.className = 'track-card';
            
            const formattedDate = new Date(track.createdAt).toLocaleDateString();
            const formattedDuration = formatTime(track.duration);
            
            trackCard.innerHTML = `
                <div class="track-card-header">
                    <h2 class="track-title">${track.title}</h2>
                    <div class="track-date">${formattedDate} - ${formattedDuration}</div>
                </div>
                <div class="track-actions">
                    <button class="play-track" data-track-id="${track.id}">
                        <i class="fas fa-play"></i> Play
                    </button>
                    <button class="secondary view-track" data-view="track-detail" data-track-id="${track.id}">
                        View Details
                    </button>
                </div>
            `;
            
            trackListElement.appendChild(trackCard);
        });
    }

    // Load track details for the track detail view
    function loadTrackDetails(trackId) {
        const track = mockData.tracks.find(t => t.id === trackId);
        if (!track) return;
        
        renderTrackDetail(track);
        renderComments(track);
        
        // If this is a different track than what's currently playing, load it
        if (!appState.currentTrack || appState.currentTrack.id !== track.id) {
            loadTrack(track, false); // Load but don't autoplay
        }
        
        // Update waveform seeker max value
        if (waveformSeeker && audioPlayer.duration) {
            waveformSeeker.max = audioPlayer.duration;
            waveformSeeker.value = audioPlayer.currentTime;
            console.log('in "loadTrackDetails"', {
                "audioPlayer.currentTime": audioPlayer.currentTime,
                "waveformSeeker.max": waveformSeeker.max,
                "waveformSeeker.value": waveformSeeker.value
            })
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
        
        // Set up track detail specific event listeners
        setupTrackDetailEventListeners(track);
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
    function setupEventListeners() {
        // Global player controls
        setupPlayerEventListeners();
        
        // Home view event listeners
        setupHomeViewEventListeners();
        
        // Upload view event listeners
        setupUploadViewEventListeners();
        
        // Record view event listeners
        setupRecordViewEventListeners();
        
        // Audio player events
        setupAudioPlayerEventListeners();
    }
    
    // Set up audio player event listeners
    function setupAudioPlayerEventListeners() {
        // Update progress when time updates
        audioPlayer.addEventListener('timeupdate', function() {
            if (!appState.seekingInProgress) {
                updateProgress();
            }
        });
        
        // When audio is loaded, update max values for sliders
        audioPlayer.addEventListener('loadedmetadata', function() {
            if (playerProgressSlider) {
                playerProgressSlider.max = audioPlayer.duration;
                playerProgressSlider.value = audioPlayer.currentTime;
            }
            
            if (waveformSeeker && appState.currentView === 'track-detail') {
                
                waveformSeeker.max = audioPlayer.duration;
                waveformSeeker.value = audioPlayer.currentTime;

                console.log('in "setupAudioPlayerEventListeners.loadmetadata"', {
                    "waveformSeeker.max": waveformSeeker.max,
                    "waveformSeeker.value": waveformSeeker.value
                })
            }
            
            updateProgress();
        });
        
        // When audio ends
        audioPlayer.addEventListener('ended', function() {
            appState.isPlaying = false;
            playerPlayIcon.className = 'fas fa-play';
            
            // Reset sliders
            if (playerProgressSlider) {
                playerProgressSlider.value = 0;
            }

            

            if (waveformSeeker && appState.currentView === 'track-detail') {
                waveformSeeker.value = 0;
            }

            console.log('in "audioPlayer.addEventListeners.ended"', {
                "waveformSeeker.max": waveformSeeker.max,
                "waveformSeeker.value": waveformSeeker.value
            })
            
            // Reset progress indicators
            waveformProgress.style.width = '0%';
        });
        
        // When seeking completes
        audioPlayer.addEventListener('seeked', function() {
            appState.seekingInProgress = false;
            updateProgress();
        });
    }

    // Set up global player event listeners
    function setupPlayerEventListeners() {
        // Fixed player play/pause button
        playerPlayButton.addEventListener('click', togglePlayPause);
        
        // Progress slider for seeking
        playerProgressSlider.addEventListener('mousedown', function() {
            appState.seekingInProgress = true;
        });
        
        playerProgressSlider.addEventListener('input', function() {
            // Update waveform seeker if on track detail view
            if (appState.currentView === 'track-detail' && waveformSeeker) {
                waveformSeeker.value = this.value;
                
                console.log('in "playerProgressSlider.addEventListeners.input"', {
                    "waveformSeeker.max": waveformSeeker.max,
                    "waveformSeeker.value": waveformSeeker.value
                })
                updateWaveformProgress(this.value);
                
                console.log('in "playerProgressSlider.addEventListeners.input after updateWaveformProgress"', {
                    "waveformSeeker.max": waveformSeeker.max,
                    "waveformSeeker.value": waveformSeeker.value
                })
            }
            
            // Update time display while seeking
            playerTimeDisplay.textContent = `${formatTime(this.value)} / ${formatTime(audioPlayer.duration)}`;
        });
        
        playerProgressSlider.addEventListener('change', function() {
            // Store the seek position
            appState.userSeekedTo = parseFloat(this.value);
            
            // Set the audio time
            audioPlayer.currentTime = appState.userSeekedTo;
            
            // Resume playback if it was playing
            if (appState.isPlaying) {
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
    }

    // Set up home view event listeners
    function setupHomeViewEventListeners() {
        // Delegate event listener for play buttons in track list
        trackListElement.addEventListener('click', function(e) {
            const playButton = e.target.closest('.play-track');
            if (playButton) {
                const trackId = playButton.getAttribute('data-track-id');
                const track = mockData.tracks.find(t => t.id === trackId);
                if (track) {
                    loadAndPlayTrack(track);
                }
                return;
            }
            
            const viewButton = e.target.closest('.view-track');
            if (viewButton) {
                e.preventDefault();
                const trackId = viewButton.getAttribute('data-track-id');
                appState.currentTrackId = trackId;
                navigateToView('track-detail');
            }
        });
    }

    // Set up track detail specific event listeners
    function setupTrackDetailEventListeners(track) {
        // Waveform seeker
        if (waveformSeeker) {
            waveformSeeker.addEventListener('mousedown', function() {
                appState.seekingInProgress = true;
            });
            
            waveformSeeker.addEventListener('input', function() {
                
                console.log('in "waveformSeeker.addEventListener.input"', {
                    "waveformSeeker.max": waveformSeeker.max,
                    "waveformSeeker.value": waveformSeeker.value
                })
                // Update main player slider
                if (playerProgressSlider) {
                    playerProgressSlider.value = this.value;
                }
                
                // Update waveform progress
                updateWaveformProgress(this.value);
                
                // Update time display while seeking
                playerTimeDisplay.textContent = `${formatTime(this.value)} / ${formatTime(audioPlayer.duration)}`;
            });
            
            waveformSeeker.addEventListener('change', function() {

                
                console.log('in "waveformSeeker.addEventListener.change"', {
                    "waveformSeeker.max": waveformSeeker.max,
                    "waveformSeeker.value": waveformSeeker.value
                })
                // Store the seek position
                appState.userSeekedTo = parseFloat(this.value);
                
                // Set the audio time
                audioPlayer.currentTime = appState.userSeekedTo;
                
                // Resume playback if it was playing
                if (appState.isPlaying) {
                    audioPlayer.play().catch(error => {
                        console.error('Error resuming playback after seek:', error);
                    });
                }
            });
        }
        
        // Share button
        const shareButton = document.getElementById('shareButton');
        if (shareButton) {
            shareButton.addEventListener('click', function() {
                const shareableLink = `${window.location.origin}/#share/${track.shareableLink}`;
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
                    navigateToView('home');
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
                    
                    // Set seeking in progress
                    appState.seekingInProgress = true;
                    
                    // Store the seek position
                    appState.userSeekedTo = timeInSeconds;
                    
                    // Update sliders
                    if (playerProgressSlider) {
                        playerProgressSlider.value = timeInSeconds;
                    }
                    
                    if (waveformSeeker) {
                        waveformSeeker.value = timeInSeconds;
                    }

                    
                    console.log('in "commentListElement.addEventListener.click"', {
                        "waveformSeeker.max": waveformSeeker.max,
                        "waveformSeeker.value": waveformSeeker.value
                    })
                    
                    // Update progress indicators
                    updateWaveformProgress(timeInSeconds);
                    
                    // Set the audio time
                    audioPlayer.currentTime = timeInSeconds;
                    
                    // Start playing if not already
                    if (!appState.isPlaying) {
                        audioPlayer.play().then(() => {
                            appState.isPlaying = true;
                            playerPlayIcon.className = 'fas fa-pause';
                        }).catch(error => {
                            console.error('Error playing after timestamp click:', error);
                        });
                    }
                }
            }
        });
    }

    // Set up upload view event listeners
    function setupUploadViewEventListeners() {
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
            if (!appState.selectedFile) {
                alert('Please select a file to upload');
                return;
            }
            
            const title = uploadTitleInput.value.trim();
            if (!title) {
                alert('Please enter a title for your track');
                return;
            }
            
            // In a real app, this would upload the file to the server
            alert(`File "${appState.selectedFile.name}" would be uploaded with title: ${title}`);
            
            // For demo purposes, redirect to home page
            navigateToView('home');
        });
    }

    // Set up record view event listeners
    function setupRecordViewEventListeners() {
        // Record button
        recordButton.addEventListener('click', toggleRecording);
        
        // Play button
        playButton.addEventListener('click', function() {
            if (appState.recordingUrl) {
                if (appState.isPlaying) {
                    audioPlayer.pause();
                    appState.isPlaying = false;
                    playerPlayIcon.className = 'fas fa-play';
                    this.innerHTML = '<i class="fas fa-play"></i> Play';
                } else {
                    audioPlayer.play();
                    appState.isPlaying = true;
                    playerPlayIcon.className = 'fas fa-pause';
                    this.innerHTML = '<i class="fas fa-pause"></i> Pause';
                }
            }
        });
        
        // Reset button
        resetButton.addEventListener('click', function() {
            if (appState.recordingUrl) {
                // Reset recording
                appState.audioChunks = [];
                appState.recordingBlob = null;
                
                if (appState.recordingUrl) {
                    URL.revokeObjectURL(appState.recordingUrl);
                    appState.recordingUrl = null;
                }
                
                // Reset UI
                recordTimer.textContent = '00:00';
                audioLevel.style.width = '0%';
                
                // Disable buttons
                playButton.disabled = true;
                resetButton.disabled = true;
                saveButton.disabled = true;
                discardButton.disabled = true;
                
                // Hide player
                fixedPlayer.classList.remove('player-visible');
                fixedPlayer.classList.add('player-hidden');
                
                // Enable record button
                recordButton.disabled = false;
            }
        });
        
        // Save button
        saveButton.addEventListener('click', function() {
            const title = recordTitleInput.value.trim();
            if (!title) {
                alert('Please enter a title for your recording');
                return;
            }
            
            // In a real app, this would upload the recording to the server
            alert(`Recording "${title}" would be saved to the server`);
            
            // For demo purposes, redirect to home page
            navigateToView('home');
        });
        
        // Discard button
        discardButton.addEventListener('click', function() {
            if (confirm('Are you sure you want to discard this recording?')) {
                // Reset everything
                resetButton.click();
                recordTitleInput.value = '';
                recordDescriptionInput.value = '';
            }
        });
    }

    // Handle file selection in upload view
    function handleFileSelect(file) {
        // Check if file is audio
        if (!file.type.match('audio/(mp3|wav)')) {
            alert('Please select an MP3 or WAV file');
            return;
        }
        
        appState.selectedFile = file;
        
        // Update file info
        fileName.textContent = file.name;
        fileSize.textContent = (file.size / 1024).toFixed(2);
        fileInfo.style.display = 'block';
        
        // Auto-fill title from filename
        const titleFromFile = file.name.replace(/\.(mp3|wav)$/i, '').replace(/_/g, ' ');
        uploadTitleInput.value = titleFromFile;
        
        // Preview the audio
        const fileURL = URL.createObjectURL(file);
        loadTrack({
            title: titleFromFile,
            audioUrl: fileURL
        }, false);
    }

    // Toggle recording state
    function toggleRecording() {
        if (appState.isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    }

    // Start recording
    function startRecording() {
        // Request microphone access
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                // Create media recorder
                appState.mediaRecorder = new MediaRecorder(stream);
                
                // Set up event handlers
                appState.mediaRecorder.ondataavailable = function(e) {
                    appState.audioChunks.push(e.data);
                };
                
                appState.mediaRecorder.onstop = function() {
                    // Create blob from chunks
                    appState.recordingBlob = new Blob(appState.audioChunks, { type: 'audio/webm' });
                    
                    // Create URL for the blob
                    if (appState.recordingUrl) {
                        URL.revokeObjectURL(appState.recordingUrl);
                    }
                    appState.recordingUrl = URL.createObjectURL(appState.recordingBlob);
                    
                    // Load as current track
                    loadTrack({
                        title: 'New Recording',
                        audioUrl: appState.recordingUrl
                    }, false);
                    
                    // Enable buttons
                    playButton.disabled = false;
                    resetButton.disabled = false;
                    saveButton.disabled = false;
                    discardButton.disabled = false;
                    
                    // Auto-fill title
                    if (!recordTitleInput.value) {
                        const now = new Date();
                        recordTitleInput.value = `Recording ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
                    }
                };
                
                // Start recording
                appState.audioChunks = [];
                appState.mediaRecorder.start();
                appState.isRecording = true;
                
                // Update UI
                recordButton.innerHTML = '<i class="fas fa-stop"></i>';
                recordButton.classList.add('recording');
                
                // Start timer
                appState.recordingStartTime = Date.now();
                appState.recordingTimer = setInterval(updateRecordingTimer, 1000);
                
                // Simulate audio level visualization
                simulateAudioLevel();
            })
            .catch(error => {
                console.error('Error accessing microphone:', error);
                alert('Could not access microphone. Please ensure you have granted permission.');
            });
    }

    // Stop recording
    function stopRecording() {
        if (appState.mediaRecorder && appState.isRecording) {
            appState.mediaRecorder.stop();
            appState.isRecording = false;
            
            // Stop all tracks in the stream
            appState.mediaRecorder.stream.getTracks().forEach(track => track.stop());
            
            // Update UI
            recordButton.innerHTML = '<i class="fas fa-microphone"></i>';
            recordButton.classList.remove('recording');
            
            // Stop timer
            clearInterval(appState.recordingTimer);
        }
    }

    // Update recording timer
    function updateRecordingTimer() {
        const elapsedSeconds = Math.floor((Date.now() - appState.recordingStartTime) / 1000);
        const minutes = Math.floor(elapsedSeconds / 60);
        const seconds = elapsedSeconds % 60;
        recordTimer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    // Simulate audio level visualization
    function simulateAudioLevel() {
        if (appState.isRecording) {
            const level = Math.random() * 80 + 10; // Random level between 10% and 90%
            audioLevel.style.width = `${level}%`;
            setTimeout(simulateAudioLevel, 100);
        } else {
            audioLevel.style.width = '0%';
        }
    }

    // Load a track into the player without playing
    function loadTrack(track, autoplay = false) {
        appState.currentTrack = track;
        audioPlayer.src = track.audioUrl;
        playerTrackTitle.textContent = track.title;
        
        // Show the player
        fixedPlayer.classList.remove('player-hidden');
        fixedPlayer.classList.add('player-visible');
        
        // Autoplay if requested
        if (autoplay) {
            audioPlayer.play().then(() => {
                appState.isPlaying = true;
                playerPlayIcon.className = 'fas fa-pause';
            }).catch(error => {
                console.error('Error playing audio:', error);
            });
        }
    }

    // Load and play a track
    function loadAndPlayTrack(track) {
        loadTrack(track, true);
    }

    // Toggle play/pause
    function togglePlayPause() {
        if (!appState.currentTrack) return;
        
        if (appState.isPlaying) {
            audioPlayer.pause();
            appState.isPlaying = false;
            playerPlayIcon.className = 'fas fa-play';
            
            // Update play button in record view if visible
            if (appState.currentView === 'record' && playButton) {
                playButton.innerHTML = '<i class="fas fa-play"></i> Play';
            }
        } else {
            audioPlayer.play().then(() => {
                appState.isPlaying = true;
                playerPlayIcon.className = 'fas fa-pause';
                
                // Update play button in record view if visible
                if (appState.currentView === 'record' && playButton) {
                    playButton.innerHTML = '<i class="fas fa-pause"></i> Pause';
                }
            }).catch(error => {
                console.error('Error playing audio:', error);
            });
        }
    }

    // Update progress indicators and sliders
    function updateProgress() {
        if (!appState.currentTrack || !audioPlayer.duration) return;
        
        console.log('in updateProgress', { "audioPlayer.currentTime": audioPlayer.currentTime })
        const currentTime = audioPlayer.currentTime;
        const duration = audioPlayer.duration;
        
        // If user has just seeked, don't override their position
        if (appState.userSeekedTo !== null) {
            // Only use the user's seek position for a short time to ensure it takes effect
            setTimeout(() => {
                appState.userSeekedTo = null;
            }, 200);
            return;
        }
        
        // Update player progress slider
        if (playerProgressSlider && !appState.seekingInProgress) {
            playerProgressSlider.value = currentTime;
        }
        
        // Update waveform seeker if on track detail view
        if (appState.currentView === 'track-detail' && waveformSeeker && !appState.seekingInProgress) {
            waveformSeeker.value = currentTime;
        }

        
        console.log('in "updateProgress"', {
            "waveformSeeker.max": waveformSeeker.max,
            "waveformSeeker.value": waveformSeeker.value
        })

        // Update waveform progress indicator
        updateWaveformProgress(currentTime);
        
        // Update time display
        playerTimeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
    }
    
    // Update waveform progress indicator
    function updateWaveformProgress(currentTime) {
        if (!waveformProgress) return;
        
        const duration = audioPlayer.duration || 0;
        if (duration > 0) {
            const progressPercent = (currentTime / duration) * 100;
            waveformProgress.style.width = `${progressPercent}%`;
        }
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
