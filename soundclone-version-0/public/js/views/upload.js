import { tags } from 'micro-js-html'
import { uploadTrack } from '../api.js'

const { main, h1, div, i, p, input, label, textarea, button, span, a } = tags

export class UploadView {
  constructor() {
    this.selectedFile = null
    this.dragover = false
    this.uploading = false
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
    if (window.audioSystem) {
      const fileURL = URL.createObjectURL(file)
      console.log('Created fileUrl:', fileURL)
      // Load track for preview but don't autoplay
      window.audioSystem.loadTrack({
        title: titleFromFile,
        audioUrl: fileURL
      }, false)
    }
    
    // Re-render to show file info
    renderApp()
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
    
    // Create form data for upload
    const formData = new FormData()
    formData.append('audio', this.selectedFile)
    formData.append('title', title)
    
    if (description) {
      formData.append('description', description)
    }
    
    this.uploading = true
    renderApp()
    
    try {
      const track = await uploadTrack(formData)
      console.log('Track uploaded successfully:', track)
      
      // Reset form
      this.reset()
      
      alert('Track uploaded successfully!')
      
      // Navigate back to home
      window.location.hash = '#home'
    } catch (error) {
      console.error('Error uploading track:', error)
      alert('Failed to upload track. Please try again.')
    } finally {
      this.uploading = false
      renderApp()
    }
  }

  reset() {
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

  setupEventListeners() {
    const dropArea = document.getElementById('dropArea')
    const fileInput = document.getElementById('fileInput')
    const uploadButton = document.getElementById('uploadButton')
    
    if (dropArea) {
      dropArea.addEventListener('click', () => fileInput?.click())
      
      dropArea.addEventListener('dragover', (e) => {
        e.preventDefault()
        this.dragover = true
        renderApp()
      })
      
      dropArea.addEventListener('dragleave', () => {
        this.dragover = false
        renderApp()
      })
      
      dropArea.addEventListener('drop', (e) => {
        e.preventDefault()
        this.dragover = false
        
        if (e.dataTransfer.files.length) {
          this.handleFileSelect(e.dataTransfer.files[0])
        }
      })
    }
    
    if (fileInput) {
      fileInput.addEventListener('change', () => {
        if (fileInput.files.length) {
          this.handleFileSelect(fileInput.files[0])
        }
      })
    }
    
    if (uploadButton) {
      uploadButton.addEventListener('click', () => this.handleUpload())
    }
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
          id: 'dropArea' 
        },
          i({ class: 'fas fa-cloud-upload-alt fa-3x' }),
          p({}, 'Drag & Drop or Click to Select File'),
          input({ 
            type: 'file', 
            id: 'fileInput', 
            class: 'file-input', 
            accept: 'audio/mp3,audio/wav,audio/webm' 
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
        button({ 
          id: 'uploadButton',
          disabled: !this.selectedFile || this.uploading
        }, this.uploading ? 'Uploading...' : 'Upload')
      )
    )
  }
}
