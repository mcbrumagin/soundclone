import { Buffer } from 'node:buffer'

const parseMultipartData = (buffer, boundary) => {
  console.log('parseMultipartData called')
  console.log('boundary', boundary)
  const files = {}
  const fields = {}
  
  const parts = buffer.toString('binary').split('--' + boundary)
  console.log('parts count', parts.length) // is only 1 but should be 3 (file, name, description) + 1 for the empty string
  
  for (let part of parts) {
    console.log('part', part)
    if (part.includes('Content-Disposition')) {
      const headerEndIndex = part.indexOf('\r\n\r\n')
      console.log('headerEndIndex', headerEndIndex)
      if (headerEndIndex === -1) continue
      
      const headers = part.substring(0, headerEndIndex)
      const content = part.substring(headerEndIndex + 4).replace(/\r\n$/, '')
      
      const nameMatch = headers.match(/name="([^"]+)"/)
      const filenameMatch = headers.match(/filename="([^"]+)"/)
      const contentTypeMatch = headers.match(/Content-Type:\s*([^\r\n]+)/)
      
      console.log('nameMatch', nameMatch)
      console.log('filenameMatch', filenameMatch)
      console.log('contentTypeMatch', contentTypeMatch)
      if (nameMatch) {
        const name = nameMatch[1]
        console.log('name', name)
        if (filenameMatch) {
          // This is a file
          files[name] = {
            name: filenameMatch[1],
            data: Buffer.from(content, 'binary'),
            mimetype: contentTypeMatch ? contentTypeMatch[1] : 'application/octet-stream',
            size: Buffer.from(content, 'binary').length,
            mv: async function(filePath) {
              const fs = await import('node:fs')
              return fs.promises.writeFile(filePath, this.data)
            }
          }
        } else {
          // This is a regular field
          fields[name] = content
        }
      }
    } else {
      console.log('part is not a header', part)
    }
  }
  
  return { files, fields }
}

export const parseFileUpload = (request, alreadyReadBody) => {
  return new Promise((resolve, reject) => {
    const contentType = request.headers['content-type']
    
    if (!contentType || !contentType.includes('multipart/form-data')) {
      resolve({ files: {}, fields: {} })
      return
    }
    
    const boundary = contentType.split('boundary=')[1]
    if (!boundary) {
      reject(new Error('Invalid multipart boundary'))
      return
    }
    
    // Check if we have a valid alreadyReadBody (string or buffer)
    if (typeof alreadyReadBody === 'string' || Buffer.isBuffer(alreadyReadBody)) {
      try {
        // Stream already consumed - need to convert to buffer properly
        let buffer
        if (typeof alreadyReadBody === 'string') {
          // String body - convert using binary encoding to preserve bytes
          buffer = Buffer.from(alreadyReadBody, 'binary')
        } else {
          // Already a buffer
          buffer = alreadyReadBody
        }
        
        const result = parseMultipartData(buffer, boundary)
        resolve(result)
      } catch (error) {
        reject(error)
      }
      return
    }
    
    // Check if stream has already been read but no valid body was passed
    if (request.readableEnded) {
      try {
        // Try reading from stream buffer if available
        const streamData = request.read()
        const buffer = streamData ? Buffer.from(streamData, 'binary') : Buffer.alloc(0)
        const result = parseMultipartData(buffer, boundary)
        resolve(result)
      } catch (error) {
        reject(error)
      }
      return
    }
    
    // Stream not yet consumed - read it now
    let chunks = []
    
    request.on('data', chunk => {
      console.log('data chunk', chunk.length)
      chunks.push(chunk)
    })
    
    request.on('end', () => {
      try {
        const buffer = Buffer.concat(chunks)
        const result = parseMultipartData(buffer, boundary)
        resolve(result)
      } catch (error) {
        reject(error)
      }
    })
    
    request.on('error', reject)
  })
}

export default parseFileUpload
