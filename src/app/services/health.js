export default async function getHealth(payload, request) {
  try {
    console.log('getHealth service called')

    return JSON.stringify({ 
      success: true, 
      message: 'SoundClone v0 server is running',
      timestamp: new Date().toISOString()
    })
  } catch (err) {
    console.error('getHealth service error:', err)
    const error = new Error('Internal server error: ' + err.message)
    error.status = 500
    throw error
  }
}

