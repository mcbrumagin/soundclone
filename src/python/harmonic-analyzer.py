"""
Harmonic Analyzer Service
Analyzes key, bpm, time signature, and chroma features of an audio file
"""

import os
import sys
import time
import asyncio
import librosa
import librosa.display
import scipy.linalg
import scipy.stats
import numpy as np

from dataclasses import dataclass

# Add parent directory to path to import microjs
# sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../../../micro-jslanguages/python'))

from microjs import create_subscription_sync

import traceback

@dataclass
class KeyEstimator:
  """Estimate the key from a chroma feature vector
  
  Args:
    x: np.ndarray, shape (12,), chroma feature vector
    y: modes, list of mode names to guess

  Returns:
    str: best guess for key
    float: confidence score
    list: list of mode names and their confidence scores
  """

  mode_weights = { # magic numbers from Krumhansl and Schmuckler
    'ionian': np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]),
    'dorian': np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.69, 1.66, 3.69, 2.59, 3.59, 4.75]),
    'phrygian': np.array([6.59, 2.52, 3.68, 5.06, 1.03, 4.60, 3.52, 5.35, 3.54, 4.90, 1.75, 1.80]),
    'lydian': np.array([6.50, 2.33, 3.52, 2.68, 3.59, 2.59, 3.66, 5.17, 3.63, 2.59, 2.70, 3.33]),
    'mixolydian': np.array([6.47, 2.37, 3.50, 2.52, 3.64, 2.50, 3.58, 2.64, 3.68, 2.50, 2.60, 3.38]),
    'aeolian': np.array([6.39, 2.55, 3.77, 3.98, 2.71, 3.91, 2.92, 2.29, 3.70, 3.27, 3.16, 6.20]),
    'locrian': np.array([6.17, 2.74, 3.98, 2.69, 3.66, 3.68, 2.90, 2.42, 2.60, 2.70, 2.88, 6.59])
  }

  mode_weight_norms = {}

  def __post_init__(self):
    for mode, weights in self.mode_weights.items():
      self.mode_weights[mode] = scipy.stats.zscore(weights)
      self.mode_weight_norms[mode] = scipy.linalg.norm(self.mode_weights[mode])
      self.mode_weights[mode] = scipy.linalg.circulant(self.mode_weights[mode])

  def __call__(self, x: np.array) -> tuple[str, float, list[tuple[str, float]]]:
    x = scipy.stats.zscore(x)
    x_norm = scipy.linalg.norm(x)
    
    # Simplified mapping (using sharps for display)
    note_names_simple = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

    coefficients = {}
    all_estimates = []

    for mode, weights in self.mode_weights.items():
      coefficients[mode] = weights.T.dot(x) / self.mode_weight_norms[mode] / x_norm
      
      # Find best key for this mode
      best_key_idx = np.argmax(coefficients[mode])
      best_correlation = coefficients[mode][best_key_idx]
      
      # Simplified mode name (major/minor)
      mode_simple = 'major' if mode == 'ionian' else 'minor' if mode == 'aeolian' else mode
      
      all_estimates.append({
        'mode': mode,
        'mode_simple': mode_simple,
        'key_index': int(best_key_idx),
        'key': note_names_simple[best_key_idx],
        'correlation': float(best_correlation),
        'full_name': f"{note_names_simple[best_key_idx]} {mode_simple}",
        'coefficients': coefficients[mode].tolist()
      })
      
    # Sort by correlation to find the overall best
    all_estimates.sort(key=lambda x: x['correlation'], reverse=True)
    
    print(f"\n=== Key Detection Results ===")
    print(f"Top 5 estimates:")
    for i, est in enumerate(all_estimates[:5], 1):
      print(f"  {i}. {est['full_name']}: {est['correlation']:.4f}")
    
    best_estimate = all_estimates[0]
    print(f"\nBest guess: {best_estimate['full_name']} (confidence: {best_estimate['correlation']:.4f})")
    
    # Also show top result for each common mode
    print(f"\nBy mode:")
    for mode in ['ionian', 'aeolian']:
      mode_est = next(e for e in all_estimates if e['mode'] == mode)
      print(f"  {mode_est['mode_simple'].title()}: {mode_est['key']} ({mode_est['correlation']:.4f})")
    
    return best_estimate['full_name'], best_estimate['correlation'], all_estimates



key_estimator = KeyEstimator() # singleton


# Set registry URL
os.environ['MICRO_REGISTRY_URL'] = os.getenv('MICRO_REGISTRY_URL', 'http://localhost:3000')

async def message_handler(message):
    """Handler for channel messages"""
    print(f"📨 Received message: {message}")

    # const { messageId, trackId, originalFilePath, transcodedFilePath, metadataFilePath } = message
    # TODO is there a better way to get the message data?
    messageId = message.get('messageId')
    trackId = message.get('trackId')
    originalFilePath = message.get('originalFilePath')
    transcodedFilePath = message.get('transcodedFilePath')
    metadataFilePath = message.get('metadataFilePath')
    
    # Load the audio file
    y, sr = librosa.load(transcodedFilePath)

    # Compute the onset strength envelope
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)

    # Estimate the tempo (BPM)
    tempo = librosa.beat.tempo(onset_envelope=onset_env, sr=sr)


    # Compute the chroma features
    try:
      # Use CQT (Constant-Q Transform) instead of STFT for better music analysis
      # CQT has logarithmically-spaced frequency bins, better for music pitch
      y_harmonic = librosa.effects.harmonic(y)  # Remove percussive elements
      chroma = librosa.feature.chroma_cqt(y=y_harmonic, sr=sr)
      avg_chroma = np.mean(chroma, axis=1)
      
      note_names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
      print(f"\nAverage chroma vector:")
      for i, (note, val) in enumerate(zip(note_names, avg_chroma)):
        print(f"  {note:2s}: {val:.4f}")

      key, key_confidence, estimates = key_estimator(avg_chroma)
      
      print(f"\nEstimated tempo: {tempo[0]:.2f} BPM")
      print(f"Estimated key: {key} with confidence {key_confidence:.4f}")
      
    except Exception:
      traceback.print_exc()
      key = 'Unknown'
      key_confidence = 0.0
      estimates = []

    return {"status": "processed", "timestamp": time.time()}


if __name__ == '__main__':
    print("Starting pubsub-subscriber service...")
    print(f"Registry URL: {os.environ['MICRO_REGISTRY_URL']}")
    print("\nThis service subscribes to the 'processUploadedAudio' channel")
    
    # Create and register the service
    sub_id = create_subscription_sync('processUploadedAudio', message_handler)

    print(f"Subscribed to channel 'processUploadedAudio' with ID: {sub_id}")
    print("Press Ctrl+C to stop...")
    
    # Keep service running
    try:
      while True:
        time.sleep(1)
    except KeyboardInterrupt:
      print("\nShutting down...")
      sub_id.terminate()
      print("Service stopped")