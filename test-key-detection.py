#!/usr/bin/env python3
"""
Test script to debug key detection
Shows the raw chroma vector to understand what the algorithm is seeing
"""

import librosa
import numpy as np

# Load your E minor song
audio_file = "data/uploads/YOUR_SONG_HERE.webm"  # Update this path

print("Loading audio...")
y, sr = librosa.load(audio_file)

print("\n=== Raw Chroma Analysis ===")
# Method 1: STFT-based (current)
chroma_stft = librosa.feature.chroma_stft(y=y, sr=sr)
avg_chroma_stft = np.mean(chroma_stft, axis=1)

# Method 2: CQT-based (better for music)
chroma_cqt = librosa.feature.chroma_cqt(y=y, sr=sr)
avg_chroma_cqt = np.mean(chroma_cqt, axis=1)

# Method 3: Harmonic CQT (removes percussion)
y_harmonic = librosa.effects.harmonic(y)
chroma_harm = librosa.feature.chroma_cqt(y=y_harmonic, sr=sr)
avg_chroma_harm = np.mean(chroma_harm, axis=1)

notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

print("\nChroma STFT (current method):")
for i, (note, val) in enumerate(zip(notes, avg_chroma_stft)):
    marker = " ← E (should be strong for E minor)" if i == 4 else ""
    marker = marker or (" ← B (dominant of E)" if i == 11 else "")
    marker = marker or (" ← G (relative major)" if i == 7 else "")
    print(f"  {note:2s}: {val:.4f}{marker}")

print("\nChroma CQT (better for music):")
for i, (note, val) in enumerate(zip(notes, avg_chroma_cqt)):
    marker = " ← E" if i == 4 else ""
    print(f"  {note:2s}: {val:.4f}{marker}")

print("\nChroma Harmonic (removes percussion):")
for i, (note, val) in enumerate(zip(notes, avg_chroma_harm)):
    marker = " ← E" if i == 4 else ""
    print(f"  {note:2s}: {val:.4f}{marker}")

# Find strongest pitch classes
print("\n=== Strongest Pitch Classes ===")
for method_name, chroma in [("STFT", avg_chroma_stft), ("CQT", avg_chroma_cqt), ("Harmonic", avg_chroma_harm)]:
    top_indices = np.argsort(chroma)[-3:][::-1]
    print(f"\n{method_name} - Top 3:")
    for idx in top_indices:
        print(f"  {notes[idx]}: {chroma[idx]:.4f}")

