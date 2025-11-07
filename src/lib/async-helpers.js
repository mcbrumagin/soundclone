/**
 * Async utility helpers
 */

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Wait for a condition to be true with timeout
 * @param {number} timeoutMs - Total timeout in milliseconds
 * @param {number} intervalMs - Interval between checks in milliseconds
 * @param {Function} condition - Async function that returns true when condition is met
 * @param {string} errorMessage - Error message if timeout is reached
 * @returns {Promise<void>}
 * @throws {Error} If timeout is reached
 */
export async function waitFor(timeoutMs, intervalMs, condition, errorMessage) {
  const startTime = Date.now()
  let lastError = null
  
  while ((Date.now() - startTime) < timeoutMs) {
    try {
      const result = await condition()
      if (result) {
        return // Success!
      }
    } catch (err) {
      lastError = err
    }
    
    await sleep(intervalMs)
  }
  
  // Timeout reached
  throw new Error(
    errorMessage + 
    ` after ${Math.floor(timeoutMs / 1000)}s` +
    (lastError ? ` - last error: ${lastError.message}` : '')
  )
}

/**
 * Retry an async operation with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry options
 * @param {number} options.maxAttempts - Maximum number of attempts (default: 3)
 * @param {number} options.initialDelay - Initial delay in ms (default: 1000)
 * @param {number} options.maxDelay - Maximum delay in ms (default: 30000)
 * @param {number} options.backoffMultiplier - Backoff multiplier (default: 2)
 * @param {Function} options.shouldRetry - Function to determine if error is retryable
 * @returns {Promise<any>}
 */
export async function retry(fn, options = {}) {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
    shouldRetry = () => true
  } = options
  
  let lastError
  let delay = initialDelay
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      
      if (attempt === maxAttempts || !shouldRetry(err)) {
        throw err
      }
      
      console.warn(`Attempt ${attempt}/${maxAttempts} failed, retrying in ${delay}ms:`, err.message)
      await sleep(delay)
      delay = Math.min(delay * backoffMultiplier, maxDelay)
    }
  }
  
  throw lastError
}
