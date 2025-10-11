// Service registry endpoint
const SERVICE_REGISTRY_URL = window.location.origin

// Helper function to call micro-js services
const callService = async (serviceName, payload = {}) => {
  const response = await fetch(SERVICE_REGISTRY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      call: {
        name: serviceName,
        payload: payload
      }
    })
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

// Helper for file uploads using FormData
const callServiceWithFiles = async (serviceName, formData) => {
  // For file uploads, we need to send the call structure differently
  // The registry expects a JSON payload with call.name and call.payload
  // But for file uploads, we need to handle this specially
  const response = await fetch(SERVICE_REGISTRY_URL, {
    method: 'POST',
    body: formData // FormData will be handled directly by the service
  })
  
  if (!response.ok) {
    throw new Error(`Service call failed: ${response.status} ${response.statusText}`)
  }
  
  const json = await response.json()
  if (!json.success && json.message) {
    throw new Error(json.message)
  }
  return json
}

// Track operations
export const getTracks = async () => {
  const json = await callService('getTrackList')
  return json.tracks
}

export const getTrack = async trackId => {
  const json = await callService('getTrackDetail', { trackId })
  return json.track
}

export const uploadTrack = async formData => {
  const json = await callServiceWithFiles('uploadTrack', formData)
  return json.track
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

// Health check
export const getHealth = async () => {
  const json = await callService('getHealth')
  return json
} 