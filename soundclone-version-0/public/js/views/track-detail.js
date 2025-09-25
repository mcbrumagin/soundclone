import { tags } from 'micro-js-html'
import { getTrack, updateTrack, deleteTrack, addComment, updateComment, deleteComment } from '../api.js'

const { main, h1, div, i, input, textarea, button, a, h2, p } = tags

export default class TrackDetailView {
  constructor() {
    this.waveformProgress = 0
    this.currentTime = 0
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
          window.renderApp()
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
        
        window.renderApp()
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
    const waveformSeeker = document.getElementById('waveformSeeker')
    
    if (waveformSeeker) {
      waveformSeeker.addEventListener('input', (e) => {
        if (window.audioSystem) {
          const seekTime = parseFloat(e.target.value)
          window.audioSystem.seekTo(seekTime)
          this.updateWaveformProgress(seekTime, window.audioSystem.duration || 0)
        }
      })
    }
  }

  renderComment(comment) {
    const formattedDate = new Date(comment.timestamp).toLocaleDateString()
    
    // Format comment text to make timestamp tags clickable
    let commentText = comment.text
    if (comment.hasTimestamp) {
      const regex = /@(\d{2}):(\d{2})/g
      commentText = commentText.replace(regex, '<span class="timestamp-tag">@$1:$2</span>')
    }
    
    return div({ class: 'comment', onclick: (e) => {
      this.handleCommentClick(e)
    }},
      div({ class: 'comment-header' },
        div({ class: 'comment-date' }, formattedDate)
      ),
      div({ class: 'comment-text', innerHTML: commentText }),
      div({ class: 'comment-actions' },
        button({ class: 'secondary edit-comment', 'data-comment-id': comment.id, onclick: (e) => this.handleCommentEdit(e) }, 'Edit'),
        button({ class: 'secondary delete-comment', 'data-comment-id': comment.id, onclick: (e) => this.handleCommentDelete(e) }, 'Delete')
      )
    )
  }

  render(track) {
    console.log('track detail view render', track)
    const formattedDate = new Date(track.createdAt).toLocaleDateString()

    return main({ class: 'container' },
      a({ class: 'back-button', 'data-view': 'home', href: '#home' },
        i({ class: 'fas fa-arrow-left' }), ' Back to Home'
      ),
      div({ class: 'track-detail', id: 'trackDetail' },
        div({ class: 'track-detail-header' },
          div({ class: 'track-info' },
            h1({ class: 'track-title' }, track.title),
            p({ class: 'track-description' }, track.description || 'No description'),
            p({ class: 'track-meta' }, `Created: ${formattedDate}`)
          ),
          div({ class: 'track-actions' },
            button({ id: 'shareButton', onclick: () => this.handleShare() },
              i({ class: 'fas fa-share-alt' }), ' Share'
            ),
            button({ class: 'secondary', id: 'editButton', onclick: () => this.handleEdit() },
              i({ class: 'fas fa-edit' }), ' Edit'
            ),
            button({ class: 'secondary', id: 'deleteButton', onclick: () => this.handleDelete() },
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
          button({ id: 'addCommentButton', onclick: () => this.handleAddComment() }, 'Add Comment')
        ),
        div({ class: 'comment-list', id: 'commentList' },
          track.comments.length === 0 
            ? div({ class: 'empty-state' }, 'No comments yet. Be the first to comment!')
            : track.comments.map(comment => this.renderComment(comment))
        )
      )
    )
  }
}
