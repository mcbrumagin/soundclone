import { tags } from 'micro-js-html'
import { getTrack, updateTrack, deleteTrack, addComment, updateComment, deleteComment } from '../api.js'

const { main, h1, div, i, input, textarea, button, a, h2, p } = tags

const CommentComponent = (comment) => {
  const formattedDate = new Date(comment.timestamp).toLocaleDateString()
  
  // Format comment text to make timestamp tags clickable
  let commentText = comment.text
  if (comment.hasTimestamp) {
    const regex = /@(\d{2}):(\d{2})/g
    commentText = commentText.replace(regex, '<span class="timestamp-tag">@$1:$2</span>')
  }
  
  return div({ class: 'comment' },
    div({ class: 'comment-header' },
      div({ class: 'comment-date' }, formattedDate)
    ),
    div({ class: 'comment-text', innerHTML: commentText }),
    div({ class: 'comment-actions' },
      button({ class: 'secondary edit-comment', 'data-comment-id': comment.id }, 'Edit'),
      button({ class: 'secondary delete-comment', 'data-comment-id': comment.id }, 'Delete')
    )
  )
}

export class TrackDetailView {
  constructor() {
    this.currentTrack = null
    this.comments = []
    this.waveformProgress = 0
    this.currentTime = 0
  }

  async loadTrack(trackId) {
    try {
      this.currentTrack = await getTrack(trackId)
      this.comments = this.currentTrack.comments || []
      
      // Load track into audio system if available
      if (window.audioSystem && window.audioSystem.trackManager) {
        const track = window.audioSystem.trackManager.getTrack(trackId)
        if (track) {
          window.audioSystem.loadTrack(track, false) // Load but don't autoplay
        }
      }
      
      return this.currentTrack
    } catch (error) {
      console.error('Error loading track details:', error)
      throw error
    }
  }

  updateWaveformProgress(currentTime, duration) {
    if (duration > 0) {
      this.waveformProgress = (currentTime / duration) * 100
      this.currentTime = currentTime
      
      const progressElement = document.getElementById('waveformProgress')
      const seekerElement = document.getElementById('waveformSeeker')
      
      if (progressElement) {
        progressElement.style.width = `${this.waveformProgress}%`
      }
      
      if (seekerElement && !seekerElement.dragging) {
        seekerElement.value = currentTime
        seekerElement.max = duration
      }
    }
  }

  handleShare() {
    if (this.currentTrack) {
      const shareableLink = `${window.location.origin}/#track-detail/${this.currentTrack.id}`
      
      if (navigator.share) {
        navigator.share({
          title: this.currentTrack.title,
          url: shareableLink
        })
      } else {
        // Fallback - copy to clipboard
        navigator.clipboard.writeText(shareableLink).then(() => {
          alert(`Link copied to clipboard: ${shareableLink}`)
        }).catch(() => {
          alert(`Shareable link: ${shareableLink}`)
        })
      }
    }
  }

  async handleEdit() {
    if (this.currentTrack) {
      const newTitle = prompt('Enter new title:', this.currentTrack.title)
      if (newTitle !== null && newTitle.trim() !== '') {
        const newDescription = prompt('Enter new description:', this.currentTrack.description || '')
        
        try {
          const updatedTrack = await updateTrack(this.currentTrack.id, {
            title: newTitle,
            description: newDescription !== null ? newDescription : this.currentTrack.description
          })
          console.log('Track updated successfully:', updatedTrack)
        
          // Update local state
          this.currentTrack = updatedTrack
          this.rerender()
        } catch (error) {
          console.error('Error updating track:', error)
          alert('Failed to update track. Please try again.')
        }
      }
    }
  }

  async handleDelete() {
    if (this.currentTrack && confirm('Are you sure you want to delete this track?')) {
      try {
        await deleteTrack(this.currentTrack.id)
        console.log('Track deleted successfully')
        
        alert('Track deleted successfully!')
        window.location.hash = '#home'
      } catch (error) {
        console.error('Error deleting track:', error)
        alert('Failed to delete track. Please try again.')
      }
    }
  }

  async handleAddComment() {
    const commentInput = document.getElementById('commentInput')
    const commentText = commentInput?.value.trim()
    
    if (commentText) {
      try {
        const newComment = await addComment(this.currentTrack.id, commentText)
        console.log('Comment added successfully:', newComment)
        
        this.comments.push(newComment)
        commentInput.value = ''
        
        this.rerender()
      } catch (error) {
        console.error('Error adding comment:', error)
        alert('Failed to add comment. Please try again.')
      }
    }
  }

  handleTimestampClick(timeString) {
    const match = timeString.match(/@(\d{2}):(\d{2})/)
    if (match && window.audioSystem) {
      const minutes = parseInt(match[1])
      const seconds = parseInt(match[2])
      const timeInSeconds = minutes * 60 + seconds
      
      // Seek to timestamp and play
      window.audioSystem.seekTo(timeInSeconds)
      window.audioSystem.play()
    }
  }

  setupEventListeners() {
    const shareButton = document.getElementById('shareButton')
    const editButton = document.getElementById('editButton')
    const deleteButton = document.getElementById('deleteButton')
    const addCommentButton = document.getElementById('addCommentButton')
    const waveformSeeker = document.getElementById('waveformSeeker')
    const commentList = document.getElementById('commentList')
    
    if (shareButton) {
      shareButton.addEventListener('click', () => this.handleShare())
    }
    
    if (editButton) {
      editButton.addEventListener('click', () => this.handleEdit())
    }
    
    if (deleteButton) {
      deleteButton.addEventListener('click', () => this.handleDelete())
    }
    
    if (addCommentButton) {
      addCommentButton.addEventListener('click', () => this.handleAddComment())
    }
    
    if (waveformSeeker) {
      waveformSeeker.addEventListener('input', (e) => {
        if (window.audioSystem) {
          const seekTime = parseFloat(e.target.value)
          window.audioSystem.seekTo(seekTime)
          this.updateWaveformProgress(seekTime, window.audioSystem.duration || 0)
        }
      })
    }
    
    if (commentList) {
      commentList.addEventListener('click', (e) => {
        // Handle timestamp clicks
        if (e.target.classList.contains('timestamp-tag')) {
          this.handleTimestampClick(e.target.textContent)
        }
        
        // Handle comment edit/delete
        const editBtn = e.target.closest('.edit-comment')
        const deleteBtn = e.target.closest('.delete-comment')
        
        if (editBtn) {
          const commentId = editBtn.getAttribute('data-comment-id')
          const comment = this.comments.find(c => c.id === commentId)
          if (comment) {
            const newText = prompt('Edit your comment:', comment.text)
            if (newText !== null && newText.trim() !== '') {
              comment.text = newText
              comment.hasTimestamp = /@\d{2}:\d{2}/.test(newText)
              this.rerender()
            }
          }
        }
        
        if (deleteBtn) {
          const commentId = deleteBtn.getAttribute('data-comment-id')
          if (confirm('Are you sure you want to delete this comment?')) {
            this.comments = this.comments.filter(c => c.id !== commentId)
            this.rerender()
          }
        }
      })
    }
  }

  rerender() {
    document.dispatchEvent(new CustomEvent('view-update'))
  }

  render() {
    if (!this.currentTrack) {
      return div({ class: 'loading' }, 'Loading track details...')
    }

    const formattedDate = new Date(this.currentTrack.createdAt).toLocaleDateString()

    return main({ class: 'container' },
      a({ class: 'back-button', 'data-view': 'home', href: '#home' },
        i({ class: 'fas fa-arrow-left' }), ' Back to Home'
      ),
      div({ class: 'track-detail', id: 'trackDetail' },
        div({ class: 'track-detail-header' },
          div({ class: 'track-info' },
            h1({ class: 'track-title' }, this.currentTrack.title),
            p({ class: 'track-description' }, this.currentTrack.description || 'No description'),
            p({ class: 'track-meta' }, `Created: ${formattedDate}`)
          ),
          div({ class: 'track-actions' },
            button({ id: 'shareButton' },
              i({ class: 'fas fa-share-alt' }), ' Share'
            ),
            button({ class: 'secondary', id: 'editButton' },
              i({ class: 'fas fa-edit' }), ' Edit'
            ),
            button({ class: 'secondary', id: 'deleteButton' },
              i({ class: 'fas fa-trash' }), ' Delete'
            )
          )
        )
      ),
      div({ class: 'waveform', id: 'waveform' },
        div({ 
          class: 'waveform-progress', 
          id: 'waveformProgress',
          style: `width: ${this.waveformProgress || 0}%`
        }),
        input({
          type: 'range',
          id: 'waveformSeeker',
          class: 'waveform-seeker',
          min: '0',
          max: '100',
          value: this.currentTime || '0'
        })
      ),
      div({ class: 'comments-section' },
        h2({}, 'Comments'),
        div({ class: 'comment-form' },
          textarea({ 
            class: 'comment-input', 
            id: 'commentInput', 
            placeholder: 'Add a comment... Use @mm:ss to tag a timestamp'
          }),
          button({ id: 'addCommentButton' }, 'Add Comment')
        ),
        div({ class: 'comment-list', id: 'commentList' },
          this.comments.length === 0 
            ? div({ class: 'empty-state' }, 'No comments yet. Be the first to comment!')
            : this.comments.map(CommentComponent)
        )
      )
    )
  }
}
