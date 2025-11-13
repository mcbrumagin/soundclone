import { htmlTags } from 'micro-js-html'

const { div, h3, p, button, input, textarea, label } = htmlTags

// Modal state
const modalState = {
  isOpen: false,
  type: 'alert', // 'alert', 'confirm', 'prompt', 'custom'
  title: '',
  message: '',
  onConfirm: null,
  onCancel: null,
  inputValue: '',
  inputPlaceholder: '',
  confirmText: 'OK',
  cancelText: 'Cancel'
}

// Show alert modal
export const showAlert = (message, title = 'Alert') => {
  return new Promise((resolve) => {
    modalState.isOpen = true
    modalState.type = 'alert'
    modalState.title = title
    modalState.message = message
    modalState.confirmText = 'OK'
    modalState.onConfirm = () => {
      closeModal()
      resolve(true)
    }
    renderModal()
  })
}

// Show confirm modal
export const showConfirm = (message, title = 'Confirm') => {
  return new Promise((resolve) => {
    modalState.isOpen = true
    modalState.type = 'confirm'
    modalState.title = title
    modalState.message = message
    modalState.confirmText = 'OK'
    modalState.cancelText = 'Cancel'
    modalState.onConfirm = () => {
      closeModal()
      resolve(true)
    }
    modalState.onCancel = () => {
      closeModal()
      resolve(false)
    }
    renderModal()
  })
}

// Show prompt modal
export const showPrompt = (message, defaultValue = '', placeholder = '', title = 'Input') => {
  return new Promise((resolve) => {
    modalState.isOpen = true
    modalState.type = 'prompt'
    modalState.title = title
    modalState.message = message
    modalState.inputValue = defaultValue
    modalState.inputPlaceholder = placeholder
    modalState.confirmText = 'OK'
    modalState.cancelText = 'Cancel'
    modalState.onConfirm = () => {
      const value = modalState.inputValue
      closeModal()
      resolve(value)
    }
    modalState.onCancel = () => {
      closeModal()
      resolve(null)
    }
    renderModal()
  })
}

// Show textarea prompt modal (for longer inputs like descriptions)
export const showTextareaPrompt = (message, defaultValue = '', placeholder = '', title = 'Input') => {
  return new Promise((resolve) => {
    modalState.isOpen = true
    modalState.type = 'textarea'
    modalState.title = title
    modalState.message = message
    modalState.inputValue = defaultValue
    modalState.inputPlaceholder = placeholder
    modalState.confirmText = 'OK'
    modalState.cancelText = 'Cancel'
    modalState.onConfirm = () => {
      const value = modalState.inputValue
      closeModal()
      resolve(value)
    }
    modalState.onCancel = () => {
      closeModal()
      resolve(null)
    }
    renderModal()
  })
}

// Show custom edit track modal with all fields
export const showEditTrackModal = (track) => {
  return new Promise((resolve) => {
    modalState.isOpen = true
    modalState.type = 'edit-track'
    modalState.title = 'Edit Track'
    modalState.message = ''
    modalState.trackData = {
      title: track.title || '',
      description: track.description || '',
      tags: (track.tags || []).join(', ')
    }
    modalState.confirmText = 'Save'
    modalState.cancelText = 'Cancel'
    modalState.onConfirm = () => {
      const data = { ...modalState.trackData }
      closeModal()
      resolve(data)
    }
    modalState.onCancel = () => {
      closeModal()
      resolve(null)
    }
    renderModal()
  })
}

const closeModal = () => {
  modalState.isOpen = false
  modalState.inputValue = ''
  modalState.trackData = null
  renderModal()
}

const renderModal = () => {
  const modalRoot = document.getElementById('modal-root')
  if (!modalRoot) {
    console.error('Modal root element not found')
    return
  }

  if (!modalState.isOpen) {
    modalRoot.innerHTML = ''
    return
  }

  const modalContent = div({ class: 'modal-overlay', onclick: (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      if (modalState.onCancel) {
        modalState.onCancel()
      } else {
        closeModal()
      }
    }
  }},
    div({ class: 'modal-content' },
      h3({ class: 'modal-title' }, modalState.title),
      p({ class: 'modal-message' }, modalState.message),
      
      // Input field for prompt
      modalState.type === 'prompt' ? input({
        type: 'text',
        class: 'modal-input',
        placeholder: modalState.inputPlaceholder,
        value: modalState.inputValue,
        oninput: (e) => {
          modalState.inputValue = e.target.value
        },
        onkeydown: (e) => {
          if (e.key === 'Enter' && modalState.onConfirm) {
            modalState.onConfirm()
          } else if (e.key === 'Escape' && modalState.onCancel) {
            modalState.onCancel()
          }
        }
      }) : null,
      
      // Textarea for longer inputs
      modalState.type === 'textarea' ? textarea({
        class: 'modal-textarea',
        placeholder: modalState.inputPlaceholder,
        oninput: (e) => {
          modalState.inputValue = e.target.value
        },
        onkeydown: (e) => {
          if (e.key === 'Escape' && modalState.onCancel) {
            modalState.onCancel()
          }
        }
      }, modalState.inputValue) : null,
      
      // Edit track form with multiple fields
      modalState.type === 'edit-track' ? div({ class: 'modal-form' },
        div({ class: 'modal-form-group' },
          htmlTags.label({ class: 'modal-label' }, 'Title'),
          input({
            type: 'text',
            class: 'modal-input',
            placeholder: 'Track title',
            value: modalState.trackData?.title || '',
            oninput: (e) => {
              if (!modalState.trackData) modalState.trackData = {}
              modalState.trackData.title = e.target.value
            }
          })
        ),
        div({ class: 'modal-form-group' },
          htmlTags.label({ class: 'modal-label' }, 'Description'),
          textarea({
            class: 'modal-textarea',
            placeholder: 'Track description (optional)',
            oninput: (e) => {
              if (!modalState.trackData) modalState.trackData = {}
              modalState.trackData.description = e.target.value
            }
          }, modalState.trackData?.description || '')
        ),
        div({ class: 'modal-form-group' },
          htmlTags.label({ class: 'modal-label' }, 'Tags'),
          input({
            type: 'text',
            class: 'modal-input',
            placeholder: 'e.g., rock, indie, acoustic',
            value: modalState.trackData?.tags || '',
            oninput: (e) => {
              if (!modalState.trackData) modalState.trackData = {}
              modalState.trackData.tags = e.target.value
            }
          })
        )
      ) : null,
      
      div({ class: 'modal-actions' },
        modalState.type !== 'alert' ? button({
          class: 'secondary',
          onclick: () => {
            if (modalState.onCancel) {
              modalState.onCancel()
            } else {
              closeModal()
            }
          }
        }, modalState.cancelText) : null,
        
        button({
          onclick: () => {
            if (modalState.onConfirm) {
              modalState.onConfirm()
            } else {
              closeModal()
            }
          }
        }, modalState.confirmText)
      )
    )
  )

  modalRoot.innerHTML = modalContent.render()
  
  // Auto-focus input if prompt
  if (modalState.type === 'prompt') {
    setTimeout(() => {
      const input = modalRoot.querySelector('.modal-input')
      if (input) {
        input.focus()
        input.select()
      }
    }, 50)
  } else if (modalState.type === 'textarea') {
    setTimeout(() => {
      const textarea = modalRoot.querySelector('.modal-textarea')
      if (textarea) {
        textarea.focus()
      }
    }, 50)
  } else if (modalState.type === 'edit-track') {
    setTimeout(() => {
      const input = modalRoot.querySelector('.modal-input')
      if (input) {
        input.focus()
        input.select()
      }
    }, 50)
  }
}

// Initialize modal root on module load
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('modal-root')) {
      const modalRoot = document.createElement('div')
      modalRoot.id = 'modal-root'
      document.body.appendChild(modalRoot)
    }
  })
}

