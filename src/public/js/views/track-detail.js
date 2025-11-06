import { htmlTags } from 'micro-js-html'
import { getTrack, updateTrack, deleteTrack, addComment, updateComment, deleteComment } from '../api.js'

const { main, h1, div, span, i, input, textarea, button, a, h2, p, img, hr } = htmlTags

export default class TrackDetailView {
  constructor() {
    this.waveformProgress = 0
    this.currentTime = 0
    this.editingCommentId = null
    this.editingCommentText = ''
    this.setupGlobalListeners()
  }

  setupGlobalListeners() {
    // Add spacebar play/pause
    if (!window.trackDetailSpacebarListener) {
      window.trackDetailSpacebarListener = (e) => {
        // Only if we're on track detail view or sidebar is open
        if (e.code === 'Space' && !e.target.matches('input, textarea, button')) {
          e.preventDefault()
          if (appState.player.isPlaying) {
            appState.player.pause()
          } else {
            // Use current track or last interacted track
            const trackId = appState.player.currentTrack?.id || this.currentTrack?.id
            if (trackId) {
              appState.player.play(trackId)
            }
          }
        }
      }
      document.addEventListener('keydown', window.trackDetailSpacebarListener)
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

  startEditingComment(commentId, currentText) {
    console.log('Start editing comment:', commentId)
    this.editingCommentId = commentId
    this.editingCommentText = currentText
    window.renderApp()
  }

  cancelEditingComment() {
    console.log('Cancel editing comment')
    this.editingCommentId = null
    this.editingCommentText = ''
    window.renderApp()
  }

  async saveCommentEdit() {
    if (!this.editingCommentId) return
    
    console.log('Save comment edit:', this.editingCommentId, this.editingCommentText)
    
    try {
      await updateComment(this.currentTrack.id, this.editingCommentId, this.editingCommentText)
      console.log('Comment updated successfully')
      
      // Update local comment in track data
      const comment = this.currentTrack.comments.find(c => c.id === this.editingCommentId)
      if (comment) {
        comment.text = this.editingCommentText
        comment.updatedAt = new Date().toISOString()
      }
      
      this.editingCommentId = null
      this.editingCommentText = ''
      window.renderApp()
    } catch (error) {
      console.error('Failed to update comment:', error)
      alert('Failed to update comment')
    }
  }

  async handleCommentDelete(commentId) {
    if (!confirm('Are you sure you want to delete this comment?')) return
    
    console.log('Delete comment:', commentId)
    
    try {
      await deleteComment(this.currentTrack.id, commentId)
      console.log('Comment deleted successfully')
      
      // Remove comment from local data
      this.currentTrack.comments = this.currentTrack.comments.filter(c => c.id !== commentId)
      
      window.renderApp()
    } catch (error) {
      console.error('Failed to delete comment:', error)
      alert('Failed to delete comment')
    }
  }

  async handleTimestampClick(event) {
    let element = event.target
    let timestamp = element.dataset.timestamp
    console.log('Timestamp clicked:', timestamp)
    
    // Match both @m:ss and @mm:ss formats
    const match = timestamp.match(/(\d{1,2}):(\d{2})/)
    if (match) {
      const minutes = parseInt(match[1])
      const seconds = parseInt(match[2])
      const timeInSeconds = minutes * 60 + seconds
      
      console.log(`Seeking to ${minutes}:${seconds} (${timeInSeconds}s)`)
      
      // If this is not the current track, load it first
      const wasNewTrack = !this.currentTrack || appState.player.currentTrack?.id !== this.currentTrack.id
      if (wasNewTrack) {
        console.log('Loading track before seeking')
        await appState.player.loadTrack(this.currentTrack)
        // Re-render to show progress elements for newly loaded track
        window.renderApp()
        // Wait a tick for DOM to update
        await new Promise(resolve => setTimeout(resolve, 10))
      }
      
      // Seek to the timestamp
      appState.player.seekTo(timeInSeconds)
      
      // Update progress immediately
      this.updateWaveformProgress(timeInSeconds, this.currentTrack.duration || 0)
      
      // Auto-play
      if (!appState.player.isPlaying) {
        await appState.player.play(this.currentTrack.id)
      }
    }
  }

  renderComment(comment) {
    const formattedDate = new Date(comment.timestamp).toLocaleDateString()
    const isEditing = this.editingCommentId === comment.id
    
    // If editing this comment, show textarea with save/cancel
    if (isEditing) {
      return div({ class: 'comment comment-editing' },
        div({ class: 'comment-header' },
          div({ class: 'comment-date' }, formattedDate)
        ),
        textarea({ 
          class: 'comment-input', 
          id: `editComment-${comment.id}`,
          value: this.editingCommentText,
          oninput: (e) => {
            this.editingCommentText = e.target.value
          }
        }, this.editingCommentText),
        div({ class: 'comment-actions' },
          button({
            class: 'save-comment',
            onclick: () => this.saveCommentEdit()
          }, 'Save'),
          button({
            class: 'secondary cancel-edit',
            onclick: () => this.cancelEditingComment()
          }, 'Cancel')
        )
      )
    }
    
    // Normal display mode
    const getTimestampReplacementString = () => span({
      class: 'timestamp-tag',
      "data-timestamp": "$1:$2",
      onclick: this.handleTimestampClick.bind(this)
    }, "@$1:$2" ).render()

    let commentText = comment.text
    if (comment.hasTimestamp) {
      // Match both @m:ss and @mm:ss formats
      const regex = /@(\d{1,2}):(\d{2})/g
      commentText = commentText.replace(regex, getTimestampReplacementString())
    }
    
    return div({ class: 'comment' },
      div({ class: 'comment-header' },
        div({ class: 'comment-date' }, formattedDate)
      ),
      div({ class: 'comment-text' }, commentText),
      div({ class: 'comment-actions' },
        button({
          class: 'secondary edit-comment',
          onclick: () => this.startEditingComment(comment.id, comment.text)
        }, 'Edit'),
        button({
          class: 'secondary delete-comment',
          onclick: () => this.handleCommentDelete(comment.id)
        }, 'Delete')
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
      h1({ class: 'track-title' }, track.title),
      hr({ class: 'title-underline'}),
      div({ class: 'track-detail', id: 'trackDetail' },
        div({ class: 'track-detail-header' },
          div({ class: 'track-info' },
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
      div({ 
        class: 'waveform', 
        id: 'waveform',
        'data-track-id': track.id,
        onclick: async (e) => {
          // Click anywhere on waveform to seek
          if (e.target.classList.contains('waveform') || e.target.classList.contains('waveform-image')) {
            const rect = e.currentTarget.getBoundingClientRect()
            const x = e.clientX - rect.left
            const percentage = (x / rect.width) * 100
            const seekTime = (percentage / 100) * (track.duration || 0)
            
            console.log('Waveform clicked:', { x, width: rect.width, percentage, seekTime, duration: track.duration })
            
            // Load this track if not current
            const wasNewTrack = appState.player.currentTrack?.id !== track.id
            if (wasNewTrack) {
              await appState.player.loadTrack(track)
              // Re-render to show progress elements for newly loaded track
              window.renderApp()
              // Wait a tick for DOM to update
              await new Promise(resolve => setTimeout(resolve, 10))
            }
            
            appState.player.seekTo(seekTime)
            
            // Update progress immediately after seeking
            this.updateWaveformProgress(seekTime, track.duration || 0)
            
            // Auto-play after seeking
            if (!appState.player.isPlaying) {
              await appState.player.play(track.id)
            }
          }
        }
      },
        // Show waveform image if available
        track.waveformUrl ? img({
          src: track.waveformUrl,
          alt: 'Waveform',
          class: 'waveform-image'
        }) : div({ class: 'waveform-image' }, 'still processing waveform...'),
        // Only show progress if this is the currently playing track
        div({ 
          class: 'waveform-progress', 
          id: 'waveformProgress',
          style: `width: ${
            appState.player.currentTrack?.id === track.id ? this.waveformProgress || 0 : 0
          }%; display: ${
            appState.player.currentTrack?.id === track.id ? 'block' : 'none'
          };`
        }),
        input({
          type: 'range',
          id: 'waveformSeeker',
          class: 'waveform-seeker',
          min: '0',
          max: track.duration || '100',
          value: appState.player.currentTrack?.id === track.id ? this.currentTime || '0' : '0',
          oninput: async (e) => {
            const seekTime = parseFloat(e.target.value)
            
            // Load this track if not current
            const wasNewTrack = appState.player.currentTrack?.id !== track.id
            if (wasNewTrack) {
              await appState.player.loadTrack(track)
              // Re-render to show progress elements for newly loaded track
              window.renderApp()
              // Wait a tick for DOM to update
              await new Promise(resolve => setTimeout(resolve, 10))
              // Auto-play when seeking on a new track
              if (!appState.player.isPlaying) {
                await appState.player.play(track.id)
              }
            }
            
            appState.player.seekTo(seekTime)
            this.updateWaveformProgress(seekTime, track.duration || 0)
          }
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
