import { htmlTags } from 'micro-js-html'
import { getTrack, updateTrack, deleteTrack, addComment, updateComment, deleteComment } from '../api.js'
import { showAlert, showConfirm, showPrompt, showTextareaPrompt, showEditTrackModal } from '../components/modal.js'

const { main, h1, div, span, i, input, textarea, button, a, h2, p, img, hr, em } = htmlTags

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
      
      if (progressElement) {
        progressElement.style.width = `${this.waveformProgress}%`
      }

    } else console.warn('updateWaveformProgress: duration is 0', currentTime, duration)
  }

  async handleShare(track) {
    // Use this.currentTrack if track is not provided
    const targetTrack = track || this.currentTrack
    if (targetTrack) {
      const shareableLink = `${window.location.origin}/#track-detail/${targetTrack.id}`
      
      if (navigator.share) {
        try {
          await navigator.share({
            title: targetTrack.title,
            url: shareableLink
          })
        } catch (err) {
          if (err.name !== 'AbortError') {
            console.error('Share failed:', err)
          }
        }
      } else {
        // Fallback - copy to clipboard
        try {
          await navigator.clipboard.writeText(shareableLink)
          await showAlert(`Link copied to clipboard!`, 'Share')
        } catch (err) {
          await showAlert(shareableLink, 'Share Link')
        }
      }
    } else console.warn('handleShare: no track to share')
  }

  async handleEdit(track) {
    // Use this.currentTrack if track is not provided
    const targetTrack = track || this.currentTrack
    if (targetTrack) {
      const result = await showEditTrackModal(targetTrack)
      
      if (result && result.title && result.title.trim() !== '') {
        // Parse and normalize tags
        const newTags = result.tags
          .split(/[,\s]+/)
          .map(tag => tag.trim().toLowerCase().replace(/\s+/g, '-'))
          .filter(tag => tag.length > 0)
        
        try {
          const updatedTrack = await updateTrack(targetTrack.id, {
            title: result.title.trim(),
            description: result.description.trim(),
            tags: newTags
          })
          console.log('Track updated successfully:', updatedTrack)
        
          // Update local state
          this.currentTrack = updatedTrack
          
          // Update in global tracks array
          const trackIndex = appState.tracks.findIndex(t => t.id === targetTrack.id)
          if (trackIndex !== -1) {
            appState.tracks[trackIndex] = updatedTrack
          }
          
          window.renderApp()
        } catch (error) {
          console.error('Error updating track:', error)
          await showAlert('Failed to update track. Please try again.', 'Error')
        }
      } else if (result) {
        await showAlert('Title is required', 'Error')
      }
    } else console.warn('handleEdit: no track to edit')
  }

  async handleDelete(track) {
    // Use this.currentTrack if track is not provided
    const targetTrack = track || this.currentTrack
    if (targetTrack) {
      const confirmed = await showConfirm(
        `Are you sure you want to delete "${targetTrack.title}"? This action cannot be undone.`,
        'Delete Track'
      )
      
      if (confirmed) {
        try {
          await deleteTrack(targetTrack.id)
          console.log('Track deleted successfully')
          
          // Stop player if currently playing this track
          if (appState.player.currentTrack?.id === targetTrack.id) {
            appState.player.pause()
            appState.player.currentTrack = null
          }
          
          // Clear selected track if it matches
          if (appState.selectedTrackId === targetTrack.id) {
            appState.selectedTrackId = null
          }
          
          // Remove from global tracks array
          appState.tracks = appState.tracks.filter(t => t.id !== targetTrack.id)
          
          await showAlert('Track deleted successfully!', 'Success')
          window.location.hash = '#home' // doesn't guarantee re-render
          window.renderApp()
        } catch (error) {
          console.error('Error deleting track:', error)
          await showAlert('Failed to delete track. Please try again.', 'Error')
        }
      }
    } else console.warn('handleDelete: no track to delete')
  }

  async handleAddComment(track) {
    const isLoggedIn = !!appState.accessToken
    
    if (!isLoggedIn) {
      await showAlert('You must be logged in to add comments', 'Login Required')
      return
    }
    
    const commentInput = document.getElementById('commentInput')
    const commentText = commentInput?.value.trim()
    
    if (commentText) {
      try {
        const newComment = await addComment(track.id, commentText)
        console.log('Comment added successfully:', newComment)
        
        track.comments.push(newComment)
        commentInput.value = ''
        
        window.renderApp()
      } catch (error) {
        console.error('Error adding comment:', error)
        await showAlert('Failed to add comment. Please try again.', 'Error')
      }
    } else console.warn('handleAddComment: no comment text')
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

  async saveCommentEdit(track) {
    if (!this.editingCommentId) return
    
    console.log('Save comment edit:', this.editingCommentId, this.editingCommentText)
    
    try {
      await updateComment(track.id, this.editingCommentId, this.editingCommentText)
      console.log('Comment updated successfully')
      
      // Update local comment in track data
      const comment = track.comments.find(c => c.id === this.editingCommentId)
      if (comment) {
        comment.text = this.editingCommentText
        comment.updatedAt = new Date().toISOString()
      }
      
      this.editingCommentId = null
      this.editingCommentText = ''
      window.renderApp()
    } catch (error) {
      console.error('Failed to update comment:', error)
      await showAlert('Failed to update comment', 'Error')
    }
  }

  async handleCommentDelete(track, commentId) {
    const confirmed = await showConfirm('Are you sure you want to delete this comment?', 'Delete Comment')
    if (!confirmed) return
    
    console.log('Delete comment:', commentId)
    
    try {
      await deleteComment(track.id, commentId)
      console.log('Comment deleted successfully')
      
      // Remove comment from local data
      track.comments = track.comments.filter(c => c.id !== commentId)
      
      window.renderApp()
    } catch (error) {
      console.error('Failed to delete comment:', error)
      await showAlert('Failed to delete comment', 'Error')
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
      }
      
      // Update progress immediately
      this.updateWaveformProgress(timeInSeconds, this.currentTrack.duration)
      
      // Seek to the timestamp (works with 206/range requests)
      appState.player.seekTo(timeInSeconds)
      
      // Auto-play
      if (!appState.player.isPlaying) {
        await appState.player.play(this.currentTrack.id)
      }
    }
  }

  renderComment(track, comment) {
    const formattedDate = new Date(comment.timestamp).toLocaleDateString()
    const isEditing = this.editingCommentId === comment.id
    const isLoggedIn = !!appState.accessToken
    
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
            onclick: () => this.saveCommentEdit(track)
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
      isLoggedIn ? div({ class: 'comment-actions' },
        button({
          class: 'secondary edit-comment',
          onclick: () => this.startEditingComment(comment.id, comment.text)
        }, 'Edit'),
        button({
          class: 'secondary delete-comment',
          onclick: () => this.handleCommentDelete(track, comment.id)
        }, 'Delete')
      ) : null
    )
  }

  renderTags(tags) {
    if (!tags || tags.length === 0) return null
    
    return div({ class: 'track-tags' },
      ...tags.map(tag => 
        a({ 
          class: 'track-tag',
          href: `#search?tag=${encodeURIComponent(tag)}`,
          onclick: (e) => {
            e.preventDefault()
            console.log('Tag clicked:', tag)
            // TODO: Wire up tag filtering/search
          }
        }, `#${tag}`)
      )
    )
  }

  render(track) {
    console.log('track detail view render', track)
    // Store current track for methods to access
    this.currentTrack = track
    const formattedDate = new Date(track.createdAt).toLocaleDateString()
    const isLoggedIn = !!appState.accessToken

    return main({ class: 'container' },
      a({ class: 'back-button', 'data-view': 'home', href: '#home' },
        i({ class: 'fas fa-arrow-left' }), ' Back to Home'
      ),
      h1({ class: 'track-title' }, track.title),
      hr({ class: 'title-underline'}),
      div({ class: 'track-detail', id: 'trackDetail' },
        div({ class: 'track-detail-header' },
          div({ class: 'track-info' },
            this.renderTags(track.tags),
            p({ class: 'track-meta' }, `Created: ${formattedDate}`)
          ),
          div({ class: 'track-actions' },
            button({ 
              id: 'shareButton', 
              onclick: () => this.handleShare(track) 
            },
              i({ class: 'fas fa-share-alt' }), ' Share'
            ),
            button({ 
              class: 'secondary', 
              id: 'editButton', 
              disabled: !isLoggedIn,
              onclick: async () => {
                if (!isLoggedIn) {
                  await showAlert('You must be logged in to edit tracks', 'Login Required')
                } else {
                  this.handleEdit(track)
                }
              }
            },
              i({ class: 'fas fa-edit' }), ' Edit'
            ),
            button({ 
              class: 'secondary', 
              id: 'deleteButton', 
              disabled: !isLoggedIn,
              onclick: async () => {
                if (!isLoggedIn) {
                  await showAlert('You must be logged in to delete tracks', 'Login Required')
                } else {
                  this.handleDelete(track)
                }
              }
            },
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
          const rect = e.currentTarget.getBoundingClientRect()
          const x = e.clientX - rect.left
          const percentage = (x / rect.width) * 100

          const duration = appState.tracks.find(t => t.id === track.id).duration
          const seekTime = (percentage / 100) * (duration || 0)

          console.log('Waveform click - seeking to:', seekTime)

          // Load this track if not current
          const wasNewTrack = appState.player.currentTrack?.id !== track.id
          if (wasNewTrack) {
            await appState.player.loadTrack(track)
            // Re-render to show progress elements for newly loaded track
            window.renderApp()
          }
          
          // Seek with 206/range request support
          appState.player.seekTo(seekTime)
          
          // Update progress immediately
          this.updateWaveformProgress(seekTime, duration)
          
          // Auto-play after seeking
          if (!appState.player.isPlaying) {
            await appState.player.play(track.id)
          }
        }
      },
        // Show waveform image if available
        console.log('track.waveformUrl', track.waveformUrl) || null,
        track.waveformUrl ? img({
          src: track.waveformUrl,
          alt: 'Waveform',
          class: 'waveform-image'
        }) : div({ class: 'waveform-placeholder' }, em('..... still processing waveform .....')),
        // Only show progress if this is the currently playing track
        div({ 
          class: 'waveform-progress', 
          id: 'waveformProgress',
          style: `width: ${
            appState.player.currentTrack?.id === track.id ? this.waveformProgress || 0 : 0
          }%; display: ${
            appState.player.currentTrack?.id === track.id ? 'block' : 'none'
          };`
        })
      ),
      div({ class: 'track-description-section' },
        h2({}, 'About'),
        p({ class: 'track-description' }, track.description || 'No description available')
      ),
      div({ class: 'comments-section' },
        h2({}, 'Comments'),
        div({ class: 'comment-form' },
          textarea({ 
            class: 'comment-input', 
            id: 'commentInput', 
            placeholder: isLoggedIn ? 'Add a comment... Use @mm:ss to tag a timestamp' : 'Log in to add comments',
            disabled: !isLoggedIn
          }),
          button({ 
            id: 'addCommentButton', 
            disabled: !isLoggedIn,
            onclick: () => this.handleAddComment(track) 
          }, 'Add Comment')
        ),
        div({ class: 'comment-list', id: 'commentList' },
          track.comments.length === 0 
            ? div({ class: 'empty-state' }, 'No comments yet. Be the first to comment!')
            : track.comments.map(comment => this.renderComment(track, comment))
        )
      )
    )
  }
}
