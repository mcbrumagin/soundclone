import { htmlTags } from 'micro-js-html'
import { uploadTrack, getTracks } from '../api.js'
import { showAlert } from '../components/modal.js'

const { main, h1, div, i, p, input, label, textarea, button, span, a } = htmlTags

export default class UploadView {
  constructor() {
    this.selectedFile = null
    this.dragover = false
    this.uploading = false
    this.uploadStatus = null
    this.title = ''
    this.description = ''
    this.dragDropInitialized = false
  }

  setupDragAndDrop() {
    const dropArea = document.getElementById('dropArea')
    if (!dropArea) return
    
    // Only set up once - check if we already marked this specific element
    if (dropArea.dataset.dragDropReady === 'true') return
    
    console.log('Setting up drag and drop listeners')
    
    // Prevent default drag behaviors
    const preventDefaults = (e) => {
      e.preventDefault()
      e.stopPropagation()
    }
    
    // Highlight drop area when dragging over it
    const highlight = (e) => {
      preventDefaults(e)
      dropArea.classList.add('dragover')
    }
    
    const unhighlight = (e) => {
      preventDefaults(e)
      dropArea.classList.remove('dragover')
    }
    
    // Handle dropped files
    const handleDrop = (e) => {
      preventDefaults(e)
      unhighlight(e)
      
      const dt = e.dataTransfer
      const files = dt.files
      
      if (files.length > 0) {
        console.log('File dropped:', files[0].name)
        this.handleFileSelect(files[0])
      }
    }
    
    // Add event listeners to drop area
    dropArea.addEventListener('dragenter', highlight)
    dropArea.addEventListener('dragover', highlight)
    dropArea.addEventListener('dragleave', unhighlight)
    dropArea.addEventListener('drop', handleDrop)
    
    // Prevent default drag behaviors on document body to avoid file opening in browser
    document.body.addEventListener('dragover', preventDefaults)
    document.body.addEventListener('drop', preventDefaults)
    
    // Mark this element as initialized
    dropArea.dataset.dragDropReady = 'true'
    this.dragDropInitialized = true
    
    console.log('✓ Drag and drop enabled')
  }

  handleFileSelect(file) {
    console.log('File selected:', file.name, file.type)
    
    this.selectedFile = file
    
    // Auto-fill title from filename
    const titleFromFile = file.name.replace(/\.(mp3|wav|webm)$/i, '').replace(/_/g, ' ')
    this.title = titleFromFile
    
    // Update the input value
    const titleInput = document.getElementById('uploadTitleInput')
    if (titleInput) {
      titleInput.value = titleFromFile
    }
    
    // Preview the audio if audio system is available
    if (appState.player) {
      const fileURL = URL.createObjectURL(file)
      console.log('Created fileUrl:', fileURL)
      // For file preview, directly set the audio source instead of using loadTrack
      // since loadTrack expects a track with an id for API URL construction
      appState.player.audio.src = fileURL
      appState.player.audio.load()
      appState.player.currentTrack = {
        title: titleFromFile,
        audioUrl: fileURL,
        isPreview: true
      }
    }
    
    // Re-render to show file info
    window.renderApp()
  }

  async handleUpload() {
    if (!this.selectedFile) {
      await showAlert('Please select a file to upload', 'Upload Error')
      return
    }
    
    const titleInput = document.getElementById('uploadTitleInput')
    const descriptionInput = document.getElementById('uploadDescriptionInput')
    
    const title = titleInput?.value.trim()
    if (!title) {
      await showAlert('Please enter a title for your track', 'Upload Error')
      return
    }
    
    const description = descriptionInput?.value.trim()
    
    this.uploading = true
    this.uploadStatus = 'Uploading...'
    window.renderApp()
    
    try {
      // Use multipart upload with progress tracking
      const response = await uploadTrack(this.selectedFile, title, description, (percent, loaded, total) => {
        console.log(`Upload progress: ${percent.toFixed(1)}%`)
        this.uploadStatus = `Uploading... ${percent.toFixed(0)}%`
        window.renderApp()
      })
      console.log('Track uploaded successfully:', response)
      
      // Start polling for processing completion
      this.uploadStatus = 'Processing audio (transcoding, waveform & metadata extraction)...'
      window.renderApp()
      
      // Notify polling service to track this upload and poll for completion
      if (appState.trackPollingService) {
        appState.trackPollingService.notifyUpload(response.id)
      }
      
      // Reset form
      this.reset()
      
      await showAlert('Track processed successfully!', 'Success')
      
      // Navigate back to home and re-render
      window.location.hash = '#home'
      window.renderApp()
    } catch (error) {
      console.error('Error uploading track:', error)
      await showAlert('Failed to upload track. Please try again.', 'Upload Error')
    } finally {
      this.uploading = false
      this.uploadStatus = null
      window.renderApp()
    }
  }

  async pollForCompletion(trackId, maxAttempts = 60, intervalMs = 2000) {
    let attempts = 0
    
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(async () => {
        attempts++
        
        try {
          // Refresh tracks list
          const tracks = await getTracks()
          appState.tracks = tracks
          
          const track = tracks.find(t => t.id === trackId)
          
          if (!track) {
            clearInterval(checkInterval)
            reject(new Error('Track not found'))
            return
          }
          
          console.log(`Polling attempt ${attempts}: status = ${track.processingStatus}`)
          this.uploadStatus = `Processing audio... (${attempts * 2}s elapsed)`
          window.renderApp()
          
          if (track.processingStatus === 'completed') {
            clearInterval(checkInterval)
            console.log('Track processing completed!')
            resolve(track)
            return
          }
          
          if (track.processingStatus === 'failed') {
            clearInterval(checkInterval)
            reject(new Error('Track processing failed'))
            return
          }
          
          if (attempts >= maxAttempts) {
            clearInterval(checkInterval)
            reject(new Error('Processing timeout - taking longer than expected'))
            return
          }
        } catch (error) {
          console.error('Error polling for track status:', error)
          // Continue polling on error
        }
      }, intervalMs)
    })
  }

  reset() {
    if (appState.player.currentTrack?.isPreview) {
      URL.revokeObjectURL(appState.player.currentTrack.audioUrl)
      appState.player.audio.src = ''
      appState.player.currentTrack = null
    }
    
    this.selectedFile = null
    this.title = ''
    this.description = ''
    this.dragover = false
    this.dragDropInitialized = false // Reset to allow re-initialization on next render
    
    const fileInput = document.getElementById('fileInput')
    const titleInput = document.getElementById('uploadTitleInput')
    const descriptionInput = document.getElementById('uploadDescriptionInput')
    
    if (fileInput) fileInput.value = ''
    if (titleInput) titleInput.value = ''
    if (descriptionInput) descriptionInput.value = ''
  }

  render() {
    // Set up drag and drop after DOM is rendered
    setTimeout(() => this.setupDragAndDrop(), 0)
    
    return main({ class: 'container' },
      a({ class: 'back-button', 'data-view': 'home', href: '#home' },
        i({ class: 'fas fa-arrow-left' }), ' Back to Home'
      ),
      h1({ class: 'page-title' }, 'Upload Audio'),
      div({ class: 'upload-container' },
        div({ 
          class: `file-drop-area ${this.dragover ? 'dragover' : ''}`, 
          id: 'dropArea',
          onclick: () => document.getElementById('fileInput')?.click()
        },
          i({ class: 'fas fa-cloud-upload-alt fa-3x' }),
          p({}, 'Drag & Drop or Click to Select File'),
          input({ 
            type: 'file', 
            id: 'fileInput', 
            class: 'file-input', 
            accept: 'audio/*',
            onchange: (e) => {
              if (e.target.files.length) {
                this.handleFileSelect(e.target.files[0])
              }
            }
          })
        ),
        div({ 
          class: 'file-info', 
          id: 'fileInfo',
          style: this.selectedFile ? 'display: block' : 'display: none' 
        },
          p({}, 
            'Selected: ', 
            span({ id: 'fileName' }, this.selectedFile?.name || 'No file selected'),
            ' (',
            span({ id: 'fileSize' }, this.selectedFile ? (this.selectedFile.size / 1024).toFixed(2) : '0'),
            ' KB)'
          )
        ),
        div({ class: 'form-group' },
          label({ for: 'uploadTitleInput' }, 'Title'),
          input({ 
            type: 'text', 
            id: 'uploadTitleInput', 
            class: 'form-control', 
            placeholder: 'Enter a title for your track',
            value: this.title || ''
          })
        ),
        div({ class: 'form-group' },
          label({ for: 'uploadDescriptionInput' }, 'Description'),
          textarea({ 
            id: 'uploadDescriptionInput', 
            class: 'form-control', 
            placeholder: 'Enter a description (optional)'
          }, this.description || '')
        ),
        this.uploadStatus && div({ 
          style: 'background-color: var(--light-gray); padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: center;' 
        }, this.uploadStatus),
        button({ 
          id: 'uploadButton',
          disabled: !this.selectedFile || this.uploading,
          onclick: () => this.handleUpload()
        }, this.uploading ? this.uploadStatus || 'Uploading...' : 'Upload')
      )
    )
  }
}

