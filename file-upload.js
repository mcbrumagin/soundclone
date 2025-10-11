import { Buffer } from 'node:buffer'

const parseMultipartData = (buffer, boundary) => {
  const files = {}
  const fields = {}
  
  const parts = buffer.toString('binary').split('--' + boundary)
  
  for (let part of parts) {
    if (part.includes('Content-Disposition')) {
      const headerEndIndex = part.indexOf('\r\n\r\n')
      if (headerEndIndex === -1) continue
      
      const headers = part.substring(0, headerEndIndex)
      const content = part.substring(headerEndIndex + 4).replace(/\r\n$/, '')
      
      const nameMatch = headers.match(/name="([^"]+)"/)
      const filenameMatch = headers.match(/filename="([^"]+)"/)
      const contentTypeMatch = headers.match(/Content-Type:\s*([^\r\n]+)/)
      
      if (nameMatch) {
        const name = nameMatch[1]
        
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
    }
  }
  
  return { files, fields }
}

export const parseFileUpload = (request) => {
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
    
    let chunks = []
    
    request.on('data', chunk => {
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
