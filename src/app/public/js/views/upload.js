import { htmlTags } from 'micro-js-html'
import { uploadTrack, getTracks } from '../api.js'

const { main, h1, div, i, p, input, label, textarea, button, span, a } = htmlTags

export default class UploadView {
  constructor() {
    this.selectedFile = null
    this.dragover = false
    this.uploading = false
    this.uploadStatus = null
    this.title = ''
    this.description = ''
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
      alert('Please select a file to upload')
      return
    }
    
    const titleInput = document.getElementById('uploadTitleInput')
    const descriptionInput = document.getElementById('uploadDescriptionInput')
    
    const title = titleInput?.value.trim()
    if (!title) {
      alert('Please enter a title for your track')
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
      this.uploadStatus = 'Processing audio (transcoding & metadata extraction)...'
      window.renderApp()
      
      // TODO?
      // await this.pollForCompletion(response.id)
      
      // Notify polling service to reset backoff and check immediately
      if (appState.trackPollingService) {
        appState.trackPollingService.notifyUpload()
      }
      
      // Reset form
      this.reset()
      
      alert('Track processed successfully!')
      
      // Navigate back to home and re-render
      window.location.hash = '#home'
      window.renderApp()
    } catch (error) {
      console.error('Error uploading track:', error)
      alert('Failed to upload track. Please try again.')
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
    
    const fileInput = document.getElementById('fileInput')
    const titleInput = document.getElementById('uploadTitleInput')
    const descriptionInput = document.getElementById('uploadDescriptionInput')
    
    if (fileInput) fileInput.value = ''
    if (titleInput) titleInput.value = ''
    if (descriptionInput) descriptionInput.value = ''
  }

  render() {
    return main({ class: 'container' },
      a({ class: 'back-button', 'data-view': 'home', href: '#home' },
        i({ class: 'fas fa-arrow-left' }), ' Back to Home'
      ),
      h1({ class: 'page-title' }, 'Upload Audio'),
      div({ class: 'upload-container' },
        div({ 
          class: `file-drop-area ${this.dragover ? 'dragover' : ''}`, 
          id: 'dropArea',
          onclick: () => document.getElementById('fileInput')?.click(),
          ondragover: (e) => {
            e.preventDefault()
            this.dragover = true
            window.renderApp()
          },
          ondragleave: () => {
            this.dragover = false
            window.renderApp()
          },
          ondrop: (e) => {
            e.preventDefault()
            this.dragover = false
            if (e.dataTransfer.files.length) {
              this.handleFileSelect(e.dataTransfer.files[0])
            }
          }
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

