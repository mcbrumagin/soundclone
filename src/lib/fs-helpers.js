/**
 * Filesystem utility helpers
 */

import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * Check if a file or directory exists
 * @param {string} filePath - Path to check
 * @returns {Promise<boolean>}
 */
export async function fileExists(filePath) {
  try {
    await fs.access(filePath, fs.constants.F_OK)
    return true
  } catch {
    return false
  }
}

/**
 * Verify that a file exists and is valid (non-empty)
 * @param {string} filePath - Path to file
 * @param {string} description - Description for logging/errors
 * @returns {Promise<{exists: boolean, size: number, error?: string}>}
 */
export async function verifyFile(filePath, description = 'File') {
  try {
    await fs.access(filePath, fs.constants.F_OK)
    const stat = await fs.stat(filePath)
    
    if (stat.size === 0) {
      return {
        exists: true,
        size: 0,
        error: `${description} is empty (0 bytes): ${filePath}`
      }
    }
    
    return {
      exists: true,
      size: stat.size
    }
  } catch (err) {
    return {
      exists: false,
      size: 0,
      error: `Error checking ${description}: ${err.message}`
    }
  }
}

/**
 * Ensure a directory exists (create if it doesn't)
 * @param {string} dirPath - Directory path
 * @returns {Promise<void>}
 */
export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true })
}

/**
 * Safely delete a file (doesn't throw if file doesn't exist)
 * @param {string} filePath - File to delete
 * @param {Object} options - Options
 * @param {boolean} options.logNotFound - Log if file not found (default: false)
 * @returns {Promise<boolean>} - True if deleted, false if didn't exist
 */
export async function safeDelete(filePath, options = {}) {
  const { logNotFound = false } = options
  
  try {
    await fs.unlink(filePath)
    return true
  } catch (err) {
    if (err.code === 'ENOENT') {
      if (logNotFound) {
        console.log(`File not found (already deleted): ${filePath}`)
      }
      return false
    }
    throw err // Rethrow other errors
  }
}

/**
 * Delete multiple files, continuing on errors
 * @param {Array<string>} filePaths - Files to delete
 * @param {Function} onDelete - Callback for each successful deletion
 * @returns {Promise<{deleted: number, failed: Array}>}
 */
export async function deleteFiles(filePaths, onDelete) {
  const results = {
    deleted: 0,
    failed: []
  }
  
  for (const filePath of filePaths) {
    try {
      const existed = await safeDelete(filePath)
      if (existed) {
        results.deleted++
        if (onDelete) {
          await onDelete(filePath)
        }
      }
    } catch (err) {
      results.failed.push({
        filePath,
        error: err.message
      })
    }
  }
  
  return results
}

/**
 * Get file size in bytes (0 if doesn't exist)
 * @param {string} filePath - File path
 * @returns {Promise<number>}
 */
export async function getFileSize(filePath) {
  try {
    const stat = await fs.stat(filePath)
    return stat.size
  } catch {
    return 0
  }
}

/**
 * Copy file with error handling
 * @param {string} src - Source file
 * @param {string} dest - Destination file
 * @param {Object} options - Options
 * @param {boolean} options.overwrite - Overwrite if exists (default: true)
 * @returns {Promise<boolean>}
 */
export async function safeCopy(src, dest, options = {}) {
  const { overwrite = true } = options
  
  try {
    if (!overwrite && await fileExists(dest)) {
      return false
    }
    
    // Ensure destination directory exists
    await ensureDir(path.dirname(dest))
    
    await fs.copyFile(src, dest)
    return true
  } catch (err) {
    console.error(`Failed to copy ${src} to ${dest}:`, err.message)
    throw err
  }
}

/**
 * Read JSON file with error handling
 * @param {string} filePath - JSON file path
 * @param {any} defaultValue - Default value if file doesn't exist
 * @returns {Promise<any>}
 */
export async function readJSON(filePath, defaultValue = null) {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content)
  } catch (err) {
    if (err.code === 'ENOENT') {
      return defaultValue
    }
    throw err
  }
}

/**
 * Write JSON file with pretty printing
 * @param {string} filePath - JSON file path
 * @param {any} data - Data to write
 * @param {number} indent - Indentation spaces (default: 2)
 * @returns {Promise<void>}
 */
export async function writeJSON(filePath, data, indent = 2) {
  await ensureDir(path.dirname(filePath))
  await fs.writeFile(filePath, JSON.stringify(data, null, indent))
}

/**
 * Find files matching a pattern
 * @param {string} dirPath - Directory to search
 * @param {Function} predicate - Function to test each file
 * @param {Object} options - Options
 * @param {boolean} options.recursive - Search recursively (default: false)
 * @returns {Promise<Array<string>>}
 */
export async function findFiles(dirPath, predicate, options = {}) {
  const { recursive = false } = options
  const results = []
  
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)
      
      if (entry.isDirectory() && recursive) {
        const subResults = await findFiles(fullPath, predicate, options)
        results.push(...subResults)
      } else if (entry.isFile() && predicate(entry.name, fullPath)) {
        results.push(fullPath)
      }
    }
  } catch (err) {
    console.error(`Error searching directory ${dirPath}:`, err.message)
  }
  
  return results
}

