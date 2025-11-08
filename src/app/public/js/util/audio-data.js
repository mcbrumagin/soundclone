const audioContext = new (window.AudioContext || window.webkitAudioContext)();

export async function getAudioDuration(audioFile) {
  const fileReader = new FileReader()
  return new Promise((resolve, reject) => {
    fileReader.onload = async (event) => {
      let audioData = await audioContext.decodeAudioData(event.target.result)
      let duration = audioData.duration
      if (!duration) return reject(new Error('Failed to get audio duration'))
      else return resolve(duration)
    }
    fileReader.readAsArrayBuffer(audioFile)
  })
}
