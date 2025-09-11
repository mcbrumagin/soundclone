import { tags } from 'micro-js-html'
import { uploadTrack } from '../api.js'

const { main, h1, div, i, input, label, textarea, button, a } = tags

export class RecordView {
  constructor() {
    this.isRecording = false
    this.recordTime = '00:00'
    this.audioLevel = 0
    this.recordingUrl = null
    this.recordingBlob = null
    this.mediaRecorder = null
    this.audioChunks = []
    this.recordingStartTime = 0
    this.recordingTimer = null
  }

  async startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
      
      this.mediaRecorder.ondataavailable = (e) => {
        console.log('Recording data available')
        this.audioChunks.push(e.data)
      }
      
      this.mediaRecorder.onstop = () => {
        console.log('Recording stopped')
        // Create blob from chunks
        this.recordingBlob = new Blob(this.audioChunks, { type: 'audio/webm;codecs=opus' })
        
        // Create URL for the blob
        if (this.recordingUrl) {
          URL.revokeObjectURL(this.recordingUrl)
        }
        this.recordingUrl = URL.createObjectURL(this.recordingBlob)
        
        console.log('Recording URL:', this.recordingUrl)

        // Load as current track for preview
        if (window.audioSystem) {
          window.audioSystem.loadTrack({
            title: 'New Recording',
            audioUrl: this.recordingUrl
          }, false)
        }
        
        // Auto-fill title if empty
        const titleInput = document.getElementById('recordTitleInput')
        if (titleInput && !titleInput.value) {
          const now = new Date()
          titleInput.value = `Recording ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`
        }
        
        renderApp()
      }
      
      // Start recording
      this.audioChunks = []
      this.mediaRecorder.start()
      this.isRecording = true
      
      // Start timer
      this.recordingStartTime = Date.now()
      this.recordingTimer = setInterval(() => this.updateTimer(), 1000)
      
      // Simulate audio level visualization
      this.simulateAudioLevel()
      
      renderApp()
    } catch (error) {
      console.error('Error accessing microphone:', error)
      alert('Could not access microphone. Please ensure you have granted permission.')
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop()
      this.isRecording = false
      
      // Stop all tracks in the stream
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop())
      
      // Stop timer
      clearInterval(this.recordingTimer)
      
      renderApp()
    }
  }

  toggleRecording() {
    if (this.isRecording) {
      this.stopRecording()
    } else {
      this.startRecording()
    }
  }

  updateTimer() {
    const elapsedSeconds = Math.floor((Date.now() - this.recordingStartTime) / 1000)
    const minutes = Math.floor(elapsedSeconds / 60)
    const seconds = elapsedSeconds % 60
    this.recordTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    
    // Update the timer display
    const timerElement = document.getElementById('recordTimer')
    if (timerElement) {
      timerElement.textContent = this.recordTime
    }
  }

  simulateAudioLevel() {
    if (this.isRecording) {
      this.audioLevel = Math.random() * 80 + 10 // Random level between 10% and 90%
      
      const levelElement = document.getElementById('audioLevel')
      if (levelElement) {
        levelElement.style.width = `${this.audioLevel}%`
      }
      
      setTimeout(() => this.simulateAudioLevel(), 100)
    } else {
      this.audioLevel = 0
      const levelElement = document.getElementById('audioLevel')
      if (levelElement) {
        levelElement.style.width = '0%'
      }
    }
  }

  reset() {
    if (this.recordingUrl) {
      // Reset recording
      this.audioChunks = []
      this.recordingBlob = null
      
      URL.revokeObjectURL(this.recordingUrl)
      this.recordingUrl = null
      
      // Reset UI
      this.recordTime = '00:00'
      this.audioLevel = 0
      
      const titleInput = document.getElementById('recordTitleInput')
      const descriptionInput = document.getElementById('recordDescriptionInput')
      
      if (titleInput) titleInput.value = ''
      if (descriptionInput) descriptionInput.value = ''
      
      renderApp()
    }
  }

  async saveRecording() {
    const titleInput = document.getElementById('recordTitleInput')
    const descriptionInput = document.getElementById('recordDescriptionInput')
    
    const title = titleInput?.value.trim()
    if (!title) {
      alert('Please enter a title for your recording')
      return
    }
    
    if (!this.recordingBlob) {
      alert('No recording to save')
      return
    }
    
    const description = descriptionInput?.value.trim()
    
    // Create form data for upload
    const formData = new FormData()
    formData.append('audio', this.recordingBlob, 'recording.webm')
    formData.append('title', title)
    
    if (description) {
      formData.append('description', description)
    }
    
    try {
      const track = await uploadTrack(formData)
      console.log('Recording saved successfully:', track)
      
      // Reset recording state
      this.reset()
      
      alert('Recording saved successfully!')
      
      // Navigate back to home
      window.location.hash = '#home'
    } catch (error) {
      console.error('Error saving recording:', error)
      alert('Failed to save recording. Please try again.')
    }
  }

  discard() {
    if (confirm('Are you sure you want to discard this recording?')) {
      this.reset()
    }
  }



  render() {
    return main({ class: 'container' },
      a({ class: 'back-button', 'data-view': 'home', href: '#home' },
        i({ class: 'fas fa-arrow-left' }), ' Back to Home'
      ),
      h1({ class: 'page-title' }, 'Record Audio'),
      div({ class: 'record-container' },
        div({ class: 'record-interface' },
          button({ 
            class: `record-button ${this.isRecording ? 'recording' : ''}`, 
            id: 'recordButton',
            onclick: () => this.toggleRecording()
          },
            i({ class: this.isRecording ? 'fas fa-stop' : 'fas fa-microphone' })
          ),
          div({ class: 'record-timer', id: 'recordTimer' }, this.recordTime || '00:00'),
          div({ class: 'audio-level' },
            div({ 
              class: 'audio-level-fill', 
              id: 'audioLevel',
              style: `width: ${this.audioLevel || 0}%`
            })
          ),
          div({ class: 'record-controls' },
            button({
              id: 'playButton', 
              disabled: !this.recordingUrl,
              onclick: () => {
                if (this.recordingUrl && window.audioSystem) {
                  window.audioSystem.togglePlayPause()
                }
              }
            },
              i({ class: window.appState && window.appState.isPlaying ? 'fas fa-pause' : 'fas fa-play' }), 
              window.appState && window.appState.isPlaying ? ' Pause' : ' Play'
            ),
            button({ 
              id: 'resetButton', 
              disabled: !this.recordingUrl,
              onclick: () => this.reset()
            },
              i({ class: 'fas fa-undo' }),
              ' Reset'
            )
          )
        ),
        div({ class: 'form-group' },
          label({ for: 'recordTitleInput' }, 'Title'),
          input({ 
            type: 'text', 
            id: 'recordTitleInput', 
            class: 'form-control', 
            placeholder: 'Enter a title for your recording'
          })
        ),
        div({ class: 'form-group' },
          label({ for: 'recordDescriptionInput' }, 'Description'),
          textarea({ 
            id: 'recordDescriptionInput', 
            class: 'form-control', 
            placeholder: 'Enter a description (optional)'
          })
        ),
        div({ class: 'action-buttons' },
          button({
            id: 'saveButton', 
            disabled: !this.recordingUrl,
            onclick: () => this.saveRecording()
          }, 'Save Recording'),
          button({
            class: 'secondary', 
            id: 'discardButton', 
            disabled: !this.recordingUrl,
            onclick: () => this.discard()
          }, 'Discard')
        )
      )
    )
  }
}
