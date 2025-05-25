// Record page logic
document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const recordButton = document.getElementById('recordButton');
    const recordTimer = document.getElementById('recordTimer');
    const audioLevel = document.getElementById('audioLevel');
    const playButton = document.getElementById('playButton');
    const resetButton = document.getElementById('resetButton');
    const titleInput = document.getElementById('titleInput');
    const descriptionInput = document.getElementById('descriptionInput');
    const saveButton = document.getElementById('saveButton');
    const discardButton = document.getElementById('discardButton');
    
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

    // Recording state
    let mediaRecorder = null;
    let audioChunks = [];
    let recordingStartTime = 0;
    let recordingTimer = null;
    let recordingBlob = null;
    let recordingUrl = null;
    let isRecording = false;
    let isPlaying = false;

    // Initialize the page
    init();

    function init() {
        setupEventListeners();
    }

    // Set up event listeners
    function setupEventListeners() {
        // Record button
        recordButton.addEventListener('click', toggleRecording);
        
        // Play button
        playButton.addEventListener('click', function() {
            if (recordingUrl) {
                if (isPlaying) {
                    audioPlayer.pause();
                    isPlaying = false;
                    playerPlayIcon.className = 'fas fa-play';
                    this.innerHTML = '<i class="fas fa-play"></i> Play';
                } else {
                    audioPlayer.play();
                    isPlaying = true;
                    playerPlayIcon.className = 'fas fa-pause';
                    this.innerHTML = '<i class="fas fa-pause"></i> Pause';
                }
            }
        });
        
        // Reset button
        resetButton.addEventListener('click', function() {
            if (recordingUrl) {
                // Reset recording
                audioChunks = [];
                recordingBlob = null;
                
                if (recordingUrl) {
                    URL.revokeObjectURL(recordingUrl);
                    recordingUrl = null;
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
            const title = titleInput.value.trim();
            if (!title) {
                alert('Please enter a title for your recording');
                return;
            }
            
            // In a real app, this would upload the recording to the server
            alert(`Recording "${title}" would be saved to the server`);
            
            // For demo purposes, redirect to home page
            window.location.href = 'index.html';
        });
        
        // Discard button
        discardButton.addEventListener('click', function() {
            if (confirm('Are you sure you want to discard this recording?')) {
                // Reset everything
                resetButton.click();
                titleInput.value = '';
                descriptionInput.value = '';
            }
        });
        
        // Fixed player play/pause button
        playerPlayButton.addEventListener('click', function() {
            playButton.click(); // Use the same logic as the play button
        });
        
        // Progress bar click for seeking
        playerProgressBar.addEventListener('click', function(e) {
            if (!recordingUrl) return;
            
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
            playButton.innerHTML = '<i class="fas fa-play"></i> Play';
        });
    }

    // Toggle recording state
    function toggleRecording() {
        if (isRecording) {
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
                mediaRecorder = new MediaRecorder(stream);
                
                // Set up event handlers
                mediaRecorder.ondataavailable = function(e) {
                    audioChunks.push(e.data);
                };
                
                mediaRecorder.onstop = function() {
                    // Create blob from chunks
                    recordingBlob = new Blob(audioChunks, { type: 'audio/webm' });
                    
                    // Create URL for the blob
                    if (recordingUrl) {
                        URL.revokeObjectURL(recordingUrl);
                    }
                    recordingUrl = URL.createObjectURL(recordingBlob);
                    
                    // Set as audio source
                    audioPlayer.src = recordingUrl;
                    
                    // Update player
                    playerTrackTitle.textContent = 'New Recording';
                    
                    // Show player
                    fixedPlayer.classList.remove('player-hidden');
                    fixedPlayer.classList.add('player-visible');
                    
                    // Enable buttons
                    playButton.disabled = false;
                    resetButton.disabled = false;
                    saveButton.disabled = false;
                    discardButton.disabled = false;
                    
                    // Auto-fill title
                    if (!titleInput.value) {
                        const now = new Date();
                        titleInput.value = `Recording ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
                    }
                };
                
                // Start recording
                audioChunks = [];
                mediaRecorder.start();
                isRecording = true;
                
                // Update UI
                recordButton.innerHTML = '<i class="fas fa-stop"></i>';
                recordButton.classList.add('recording');
                
                // Start timer
                recordingStartTime = Date.now();
                recordingTimer = setInterval(updateRecordingTimer, 1000);
                
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
        if (mediaRecorder && isRecording) {
            mediaRecorder.stop();
            isRecording = false;
            
            // Stop all tracks in the stream
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
            
            // Update UI
            recordButton.innerHTML = '<i class="fas fa-microphone"></i>';
            recordButton.classList.remove('recording');
            
            // Stop timer
            clearInterval(recordingTimer);
        }
    }

    // Update recording timer
    function updateRecordingTimer() {
        const elapsedSeconds = Math.floor((Date.now() - recordingStartTime) / 1000);
        const minutes = Math.floor(elapsedSeconds / 60);
        const seconds = elapsedSeconds % 60;
        recordTimer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    // Simulate audio level visualization
    function simulateAudioLevel() {
        if (isRecording) {
            const level = Math.random() * 80 + 10; // Random level between 10% and 90%
            audioLevel.style.width = `${level}%`;
            setTimeout(simulateAudioLevel, 100);
        } else {
            audioLevel.style.width = '0%';
        }
    }

    // Update progress bar and time display
    function updateProgress() {
        if (!recordingUrl) return;
        
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
