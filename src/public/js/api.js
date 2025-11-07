// Service registry endpoint
const SERVICE_REGISTRY_URL = window.location.origin

// TODO add to micro-js-html?
// Helper function to call micro-js services
// const callService = async (serviceName, payload = {}) => {
//   console.log('callService', serviceName, payload)
//   const response = await fetch(SERVICE_REGISTRY_URL, {
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/json'
//     },
//     body: JSON.stringify({
//       call: {
//         name: serviceName,
//         payload: payload
//       }
//     })
//   })
  
//   if (!response.ok) {
//     throw new Error(`Service call failed: ${response.status} ${response.statusText}`)
//   }
  
//   // Handle different content types
//   const contentType = response.headers.get('content-type')
//   if (contentType && contentType.includes('application/json')) {
//     const json = await response.json()
//     if (!json.success && json.message) {
//       throw new Error(json.message)
//     }
//     return json
//   } else {
//     // For binary data like audio files
//     return response
//   }
// }

const callService = async (serviceName, payload = {}) => {
  console.log('callService', serviceName, payload)
  const response = await fetch(SERVICE_REGISTRY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'micro-command': 'service-call',
      'micro-service-name': serviceName
    },
    body: JSON.stringify(payload)
  })
  
  if (!response.ok) {
    throw new Error(`Service call failed: ${response.status} ${response.statusText}`)
  }
  
  // Handle different content types
  const contentType = response.headers.get('content-type')
  if (contentType && contentType.includes('application/json')) {
    const json = await response.json()
    if (!json.success && json.message) {
      throw new Error(json.message)
    }
    return json
  } else {
    // For binary data like audio files
    return response
  }
}

window.callService = callService

// Track operations
export const getTracks = async () => {
  const json = await callService('getTrackList')
  return json.tracks
}

export const getTrack = async trackId => {
  const json = await callService('getTrackDetail', { trackId })
  return json.track
}

// Audio upload using multipart form data
export const uploadTrack = async (audioFile, title, description, onProgress = null) => {
  return new Promise((resolve, reject) => {
    const formData = new FormData()
    
    // Add text fields first (convention: file should be last)
    formData.append('title', title)
    if (description) {
      formData.append('description', description)
    }
    
    // Add file last (per convention)
    const filename = audioFile.name || 'recording.webm'
    formData.append('audio', audioFile, filename)
    
    const xhr = new XMLHttpRequest()
    
    // Set up progress tracking if callback provided
    if (onProgress) {
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentComplete = (event.loaded / event.total) * 100
          onProgress(percentComplete, event.loaded, event.total)
        }
      })
    }
    
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText)
          if (response.success) {
            resolve(response.track)
          } else {
            reject(new Error(response.error || 'Upload failed'))
          }
        } catch (error) {
          reject(new Error('Invalid response from server'))
        }
      } else {
        reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`))
      }
    })
    
    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'))
    })
    
    xhr.addEventListener('abort', () => {
      reject(new Error('Upload was aborted'))
    })
    
    // Send to the upload route
    xhr.open('POST', `${SERVICE_REGISTRY_URL}/uploadTrack`)
    xhr.setRequestHeader('micro-auth-token', appState.accessToken)
    xhr.send(formData)
  })
}

export const updateTrack = async (trackId, data) => {
  const json = await callService('updateTrack', { trackId, ...data })
  return json.track
}

export const deleteTrack = async trackId => {
  const json = await callService('deleteTrack', { trackId })
  return json
}

// Comment operations
export const addComment = async (trackId, text) => {
  console.log('addComment', trackId, text)
  const json = await callService('createComment', { trackId, text })
  return json.comment
}

export const updateComment = async (trackId, commentId, text) => {
  const json = await callService('updateComment', { trackId, commentId, text })
  return json.comment
}

export const deleteComment = async (trackId, commentId) => {
  const json = await callService('deleteComment', { trackId, commentId })
  return json
}

// Audio file access
export const getAudioFile = async trackId => {
  const response = await callService('getAudioFile', { trackId })
  return response // Returns the fetch response for binary data
}

// For creating audio URLs for HTML audio elements
export const getAudioUrl = trackId => {
  // Create a blob URL approach or use a data URL
  // This is a simplified approach - in production you might want to cache these
  return `${SERVICE_REGISTRY_URL}/service/getAudioFile`
}

// Audio metadata
export const getTrackMetadata = async (trackId) => {
  const json = await callService('getTrackMetadata', { trackId })
  return json
}

// Health check
export const getHealth = async () => {
  const json = await callService('getHealth')
  return json
} 