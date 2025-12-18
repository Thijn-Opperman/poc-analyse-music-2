'use client';

import { useState } from 'react';

const decodeAudio = async (file: File): Promise<AudioBuffer> => {
  const audioContext = new AudioContext();
  const arrayBuffer = await file.arrayBuffer();
  return await audioContext.decodeAudioData(arrayBuffer);
};

function detectBPM(audioBuffer: AudioBuffer): number {
  // Slice channel 0
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0);
  const length = channelData.length;

  // Low-frequency band-pass filter (40-150 Hz)
  // Using cascaded high-pass and low-pass filters
  const lowCutoff = 40; // Hz
  const highCutoff = 150; // Hz
  
  // High-pass filter (remove frequencies below 40 Hz)
  const highPassFiltered = new Float32Array(length);
  const hpRC = 1 / (2 * Math.PI * lowCutoff);
  const hpAlpha = 1 / (1 + hpRC * sampleRate);
  let hpPrevInput = 0;
  let hpPrevOutput = 0;
  
  for (let i = 0; i < length; i++) {
    const input = channelData[i];
    highPassFiltered[i] = hpAlpha * (hpPrevOutput + input - hpPrevInput);
    hpPrevInput = input;
    hpPrevOutput = highPassFiltered[i];
  }
  
  // Low-pass filter (remove frequencies above 150 Hz)
  const filtered = new Float32Array(length);
  const lpRC = 1 / (2 * Math.PI * highCutoff);
  const lpAlpha = 1 / (1 + lpRC * sampleRate);
  let lpPrevOutput = 0;
  
  for (let i = 0; i < length; i++) {
    filtered[i] = lpAlpha * highPassFiltered[i] + (1 - lpAlpha) * lpPrevOutput;
    lpPrevOutput = filtered[i];
  }

  // Envelope follower / absolute amplitude
  const envelope = new Float32Array(length);
  const attackTime = 0.001; // 1ms attack
  const releaseTime = 0.1; // 100ms release
  const attackCoeff = Math.exp(-1 / (attackTime * sampleRate));
  const releaseCoeff = Math.exp(-1 / (releaseTime * sampleRate));
  
  let envelopeValue = 0;
  for (let i = 0; i < length; i++) {
    const absValue = Math.abs(filtered[i]);
    if (absValue > envelopeValue) {
      envelopeValue = absValue + (envelopeValue - absValue) * attackCoeff;
    } else {
      envelopeValue = absValue + (envelopeValue - absValue) * releaseCoeff;
    }
    envelope[i] = envelopeValue;
  }

  // Peak detection with dynamic threshold
  const peaks: number[] = [];
  const windowSize = Math.floor(sampleRate * 0.1); // 100ms window
  let lastPeakIndex = -windowSize;
  
  for (let i = windowSize; i < length - windowSize; i++) {
    const window = envelope.slice(i - windowSize, i + windowSize);
    const mean = window.reduce((a, b) => a + b, 0) / window.length;
    const std = Math.sqrt(
      window.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / window.length
    );
    const threshold = mean + 1.5 * std; // Dynamic threshold
    
    // Check if current point is a peak
    if (envelope[i] > threshold && 
        envelope[i] > envelope[i - 1] && 
        envelope[i] > envelope[i + 1] &&
        i - lastPeakIndex > windowSize) {
      peaks.push(i);
      lastPeakIndex = i;
    }
  }

  if (peaks.length < 2) {
    return 120; // Default BPM if not enough peaks
  }

  // Calculate intervals between peaks
  const intervals: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    intervals.push(peaks[i] - peaks[i - 1]);
  }

  // Create histogram of intervals → BPM
  const minBPM = 80;
  const maxBPM = 175;
  const minInterval = Math.floor(sampleRate * 60 / maxBPM); // 175 BPM max
  const maxInterval = Math.floor(sampleRate * 60 / minBPM); // 80 BPM min
  
  // Use BPM bins for histogram (1 BPM resolution)
  const bpmHistogram: { [key: number]: number } = {};
  
  for (const interval of intervals) {
    if (interval >= minInterval && interval <= maxInterval) {
      const bpm = (60 * sampleRate) / interval;
      const roundedBPM = Math.round(bpm);
      
      // Also check half-time and double-time intervals
      const halfBPM = Math.round(bpm * 2);
      const doubleBPM = Math.round(bpm / 2);
      
      if (roundedBPM >= minBPM && roundedBPM <= maxBPM) {
        bpmHistogram[roundedBPM] = (bpmHistogram[roundedBPM] || 0) + 1;
      }
      if (halfBPM >= minBPM && halfBPM <= maxBPM) {
        bpmHistogram[halfBPM] = (bpmHistogram[halfBPM] || 0) + 0.5;
      }
      if (doubleBPM >= minBPM && doubleBPM <= maxBPM) {
        bpmHistogram[doubleBPM] = (bpmHistogram[doubleBPM] || 0) + 0.5;
      }
    }
  }

  // Find most common BPM
  let maxCount = 0;
  let detectedBPM = 120; // Default BPM
  
  for (const [bpm, count] of Object.entries(bpmHistogram)) {
    if (count > maxCount) {
      maxCount = count;
      detectedBPM = parseInt(bpm);
    }
  }

  // Clamp between 80-175 BPM
  return Math.max(80, Math.min(175, detectedBPM));
}

export default function FileInput() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type
    const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave'];
    const fileExtension = file.name.toLowerCase().split('.').pop();
    const isValidType = validTypes.includes(file.type) || 
                       fileExtension === 'mp3' || 
                       fileExtension === 'wav';

    if (!isValidType) {
      setError('Please upload an MP3 or WAV file');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const audioBuffer = await decodeAudio(file);
      console.log('Audio duration:', audioBuffer.duration, 'seconds');
      console.log('Sample rate:', audioBuffer.sampleRate, 'Hz');
      console.log('Number of channels:', audioBuffer.numberOfChannels);
      console.log('AudioBuffer:', audioBuffer);
      
      // BPM detection
      const bpm = detectBPM(audioBuffer);
      console.log('Detected BPM:', bpm);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to decode audio file';
      setError(errorMessage);
      console.error('Error decoding audio:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Upload Audio File (MP3/WAV)
        </span>
        <input
          type="file"
          accept="audio/mpeg,audio/mp3,audio/wav,audio/wave,.mp3,.wav"
          onChange={handleFileChange}
          disabled={isLoading}
          className="block w-full text-sm text-zinc-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-full file:border-0
            file:text-sm file:font-semibold
            file:bg-zinc-950 file:text-white
            dark:file:bg-zinc-50 dark:file:text-zinc-950
            hover:file:bg-zinc-800 dark:hover:file:bg-zinc-200
            disabled:opacity-50 disabled:cursor-not-allowed
            cursor-pointer"
        />
      </label>
      
      {isLoading && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Decoding audio...
        </p>
      )}
      
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

