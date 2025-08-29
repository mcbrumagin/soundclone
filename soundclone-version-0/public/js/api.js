const API_BASE_URL = '/api'

const getJson = async url => {
  const res = await fetch(url)
  const json = await res.json()
  return json
}

const postJson = async (url, data) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })
  const json = await res.json()
  return json
}

const postFormData = async (url, formData) => {
  const res = await fetch(url, {
    method: 'POST',
    body: formData
  })
  const json = await res.json()
  return json
}

const putJson = async (url, data) => {
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })
  const json = await res.json()
  return json
}

const deleteRequest = async url => {
  const res = await fetch(url, {
    method: 'DELETE'
  })
  const json = await res.json()
  return json
}

// Track operations
export const getTracks = async () => {
  const json = await getJson(`${API_BASE_URL}/tracks`)
  if (!json.success) throw new Error(json.message || 'Failed to fetch tracks')
  return json.tracks
}

export const getTrack = async trackId => {
  const json = await getJson(`${API_BASE_URL}/tracks/${trackId}`)
  if (!json.success) throw new Error(json.message || 'Failed to fetch track')
  return json.track
}

export const uploadTrack = async formData => {
  const json = await postFormData(`${API_BASE_URL}/tracks`, formData)
  if (!json.success) throw new Error(json.message || 'Failed to upload track')
  return json.track
}

export const updateTrack = async (trackId, data) => {
  const json = await putJson(`${API_BASE_URL}/tracks/${trackId}`, data)
  if (!json.success) throw new Error(json.message || 'Failed to update track')
  return json.track
}

export const deleteTrack = async trackId => {
  const json = await deleteRequest(`${API_BASE_URL}/tracks/${trackId}`)
  if (!json.success) throw new Error(json.message || 'Failed to delete track')
  return json
}

// Comment operations
export const addComment = async (trackId, text) => {
  const json = await postJson(`${API_BASE_URL}/tracks/${trackId}/comments`, { text })
  if (!json.success) throw new Error(json.message || 'Failed to add comment')
  return json.comment
}

export const updateComment = async (trackId, commentId, text) => {
  const json = await putJson(`${API_BASE_URL}/tracks/${trackId}/comments/${commentId}`, { text })
  if (!json.success) throw new Error(json.message || 'Failed to update comment')
  return json.comment
}

export const deleteComment = async (trackId, commentId) => {
  const json = await deleteRequest(`${API_BASE_URL}/tracks/${trackId}/comments/${commentId}`)
  if (!json.success) throw new Error(json.message || 'Failed to delete comment')
  return json
} 