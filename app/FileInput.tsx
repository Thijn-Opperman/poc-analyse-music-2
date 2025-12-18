'use client';

import { useState } from 'react';
import Beatgrid from './Beatgrid';
import Waveform from './Waveform';
import WaveformCanvas from './WaveformCanvas';
import Meyda from 'meyda';

export const decodeAudio = async (file: File): Promise<AudioBuffer> => {
  const audioContext = new AudioContext();
  const arrayBuffer = await file.arrayBuffer();
  return await audioContext.decodeAudioData(arrayBuffer);
};

export function detectBPM(audioBuffer: AudioBuffer): number {
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

  // Peak detection with dynamic threshold (optimized for performance)
  const peaks: number[] = [];
  const windowSize = Math.floor(sampleRate * 0.1); // 100ms window
  let lastPeakIndex = -windowSize;
  
  // Calculate global threshold efficiently
  let sum = 0;
  let maxVal = 0;
  const sampleStep = Math.max(1, Math.floor(length / 10000)); // Sample 10k points max
  let sampleCount = 0;
  
  for (let i = 0; i < length; i += sampleStep) {
    const val = envelope[i];
    sum += val;
    if (val > maxVal) maxVal = val;
    sampleCount++;
  }
  
  const mean = sum / sampleCount;
  const globalThreshold = mean + (maxVal - mean) * 0.3; // Adaptive threshold
  
  // Optimized peak detection: process with hop size
  const hopSize = Math.max(1, Math.floor(sampleRate / 100)); // Process at ~100 Hz max
  const localWindowSize = Math.floor(windowSize / 2);
  let lastThreshold = globalThreshold;
  
  for (let i = windowSize; i < length - windowSize; i += hopSize) {
    // Update threshold every N samples
    if (i % (hopSize * 20) === 0) {
      const localWindow = envelope.slice(
        Math.max(0, i - localWindowSize),
        Math.min(length, i + localWindowSize)
      );
      const localMean = localWindow.reduce((a, b) => a + b, 0) / localWindow.length;
      lastThreshold = Math.max(globalThreshold, localMean * 1.5);
    }
    
    // Check if current point is a peak
    if (envelope[i] > lastThreshold && 
        envelope[i] > envelope[i - 1] && 
        envelope[i] > envelope[Math.min(length - 1, i + 1)] &&
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

export function detectDownbeat(audioBuffer: AudioBuffer, bpm: number): number {
  // Find first strong onset as downbeat start point
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0);
  const length = channelData.length;
  
  // Use energy-based onset detection (optimized)
  const windowSize = Math.floor(sampleRate * 0.023); // ~23ms window
  const hopSize = Math.max(1, Math.floor(windowSize / 4));
  const energy: number[] = [];
  
  // Limit processing to first 30 seconds for speed
  const maxSamples = Math.min(length, sampleRate * 30);
  
  // Calculate energy in windows (optimized)
  for (let i = 0; i < maxSamples - windowSize; i += hopSize) {
    let sum = 0;
    const end = Math.min(i + windowSize, maxSamples);
    for (let j = i; j < end; j++) {
      sum += channelData[j] * channelData[j];
    }
    energy.push(sum / (end - i));
  }
  
  if (energy.length < 2) {
    return 0;
  }
  
  // Find first strong onset (energy increase above threshold)
  const baselineSize = Math.min(100, energy.length);
  const baseline = energy.slice(0, baselineSize).reduce((a, b) => a + b, 0) / baselineSize;
  const threshold = baseline * 2;
  
  for (let i = 1; i < energy.length; i++) {
    const energyIncrease = energy[i] - energy[i - 1];
    if (energy[i] > threshold && energyIncrease > baseline * 0.3) {
      // Convert back to sample index
      const downbeatSample = i * hopSize;
      return downbeatSample / sampleRate; // Return in seconds
    }
  }
  
  // If no strong onset found, use start of audio
  return 0;
}

// Krumhansl-Schmuckler key profiles (major and minor)
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

// Camelot wheel mapping
const CAMELOT_MAP: { [key: string]: string } = {
  'C': '8B', 'C#': '3B', 'Db': '3B',
  'D': '10B', 'D#': '5B', 'Eb': '5B',
  'E': '12B', 'F': '7B', 'F#': '2B', 'Gb': '2B',
  'G': '9B', 'G#': '4B', 'Ab': '4B',
  'A': '11B', 'A#': '6B', 'Bb': '6B',
  'Cm': '5A', 'C#m': '12A', 'Dbm': '12A',
  'Dm': '7A', 'D#m': '2A', 'Ebm': '2A',
  'Em': '9A', 'Fm': '4A', 'F#m': '11A', 'Gbm': '11A',
  'Gm': '6A', 'G#m': '1A', 'Abm': '1A',
  'Am': '8A', 'A#m': '3A', 'Bbm': '3A',
  'Bm': '10A'
};

export function detectKey(audioBuffer: AudioBuffer): { key: string; scale: 'major' | 'minor'; camelot: string } {
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0);
  const length = channelData.length;
  
  // Frame parameters
  const frameSize = 4096;
  const hopSize = 2048;
  
  // Initialize Meyda
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  // Extract chroma features per frame
  const chromaFrames: number[][] = [];
  const energyFrames: number[] = [];
  
  // Process audio in frames
  for (let i = 0; i < length - frameSize; i += hopSize) {
    const frame = channelData.slice(i, i + frameSize);
    
    // Calculate energy (RMS) for weighting
    let energy = 0;
    for (let j = 0; j < frame.length; j++) {
      energy += frame[j] * frame[j];
    }
    energy = Math.sqrt(energy / frame.length);
    energyFrames.push(energy);
    
    // Extract chroma using Meyda
    try {
      const features = Meyda.extract(['chroma'], frame);
      if (features && features.chroma && Array.isArray(features.chroma)) {
        chromaFrames.push(features.chroma);
      }
    } catch (err) {
      // If Meyda fails, calculate simple chroma manually
      const chroma = calculateChroma(frame, sampleRate);
      chromaFrames.push(chroma);
    }
  }
  
  if (chromaFrames.length === 0) {
    return { key: 'C', scale: 'major', camelot: '8B' };
  }
  
  // Energy-weighted average chroma
  const weightedChroma = new Array(12).fill(0);
  let totalEnergy = 0;
  
  for (let i = 0; i < chromaFrames.length; i++) {
    const energy = energyFrames[i];
    totalEnergy += energy;
    for (let j = 0; j < 12; j++) {
      weightedChroma[j] += chromaFrames[i][j] * energy;
    }
  }
  
  // Normalize
  for (let j = 0; j < 12; j++) {
    weightedChroma[j] /= totalEnergy;
  }
  
  // Normalize chroma vector
  const chromaSum = weightedChroma.reduce((a, b) => a + b, 0);
  if (chromaSum > 0) {
    for (let j = 0; j < 12; j++) {
      weightedChroma[j] /= chromaSum;
    }
  }
  
  // Krumhansl-Schmuckler correlation with major/minor templates
  let maxCorrelation = -Infinity;
  let detectedKey = 'C';
  let detectedScale: 'major' | 'minor' = 'major';
  
  const keyNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  
  // Test all 12 keys for major
  for (let keyOffset = 0; keyOffset < 12; keyOffset++) {
    let correlation = 0;
    for (let i = 0; i < 12; i++) {
      const chromaIndex = (i + keyOffset) % 12;
      correlation += weightedChroma[chromaIndex] * MAJOR_PROFILE[i];
    }
    
    if (correlation > maxCorrelation) {
      maxCorrelation = correlation;
      detectedKey = keyNames[keyOffset];
      detectedScale = 'major';
    }
  }
  
  // Test all 12 keys for minor
  for (let keyOffset = 0; keyOffset < 12; keyOffset++) {
    let correlation = 0;
    for (let i = 0; i < 12; i++) {
      const chromaIndex = (i + keyOffset) % 12;
      correlation += weightedChroma[chromaIndex] * MINOR_PROFILE[i];
    }
    
    if (correlation > maxCorrelation) {
      maxCorrelation = correlation;
      detectedKey = keyNames[keyOffset];
      detectedScale = 'minor';
    }
  }
  
  // Map to Camelot notation
  const keyString = detectedScale === 'minor' ? `${detectedKey}m` : detectedKey;
  const camelot = CAMELOT_MAP[keyString] || '8B';
  
  return { key: detectedKey, scale: detectedScale, camelot };
}

// Fallback chroma calculation if Meyda fails
function calculateChroma(frame: Float32Array, sampleRate: number): number[] {
  const chroma = new Array(12).fill(0);
  const fftSize = frame.length;
  
  // Simple FFT-based chroma (simplified)
  const fft = new Array(fftSize).fill(0);
  
  // Simple DFT
  for (let k = 0; k < fftSize / 2; k++) {
    let real = 0;
    let imag = 0;
    for (let n = 0; n < fftSize; n++) {
      const angle = (2 * Math.PI * k * n) / fftSize;
      real += frame[n] * Math.cos(angle);
      imag -= frame[n] * Math.sin(angle);
    }
    const magnitude = Math.sqrt(real * real + imag * imag);
    
    // Map frequency to chroma bin
    const freq = (k * sampleRate) / fftSize;
    if (freq > 80 && freq < 5000) { // Focus on musical range
      // Convert frequency to MIDI note
      const midiNote = 69 + 12 * Math.log2(freq / 440);
      const chromaBin = Math.floor(midiNote) % 12;
      chroma[chromaBin] += magnitude;
    }
  }
  
  return chroma;
}

export interface WaveformSegment {
  r: number; // Red (low frequency)
  g: number; // Green (mid frequency)
  b: number; // Blue (high frequency)
  brightness: number; // RMS-based brightness
}

export function analyzeWaveform(
  audioBuffer: AudioBuffer,
  canvasWidth: number
): WaveformSegment[] {
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0);
  const length = channelData.length;
  
  // Calculate samples per pixel (segment)
  const samplesPerSegment = Math.floor(length / canvasWidth);
  const fftSize = 1024; // Smaller FFT for better performance
  const segments: WaveformSegment[] = [];
  
  // Frequency band definitions (in Hz)
  const lowFreqMax = 250;   // Low: 0-250 Hz
  const midFreqMin = 250;   // Mid: 250-4000 Hz
  const midFreqMax = 4000;
  const highFreqMin = 4000; // High: 4000+ Hz
  
  // Pre-calculate frequency bin ranges
  const lowBinMax = Math.floor((lowFreqMax * fftSize) / sampleRate);
  const midBinMin = Math.floor((midFreqMin * fftSize) / sampleRate);
  const midBinMax = Math.floor((midFreqMax * fftSize) / sampleRate);
  const highBinMin = Math.floor((highFreqMin * fftSize) / sampleRate);
  
  for (let pixel = 0; pixel < canvasWidth; pixel++) {
    const startSample = pixel * samplesPerSegment;
    const endSample = Math.min(startSample + samplesPerSegment, length);
    const segmentLength = endSample - startSample;
    
    if (segmentLength < fftSize) {
      // If segment is too small, calculate simple RMS only
      let rms = 0;
      for (let i = startSample; i < endSample; i++) {
        rms += channelData[i] * channelData[i];
      }
      rms = Math.sqrt(rms / segmentLength);
      const brightness = Math.min(1, rms * 2);
      
      segments.push({ 
        r: Math.floor(128 * brightness), 
        g: Math.floor(128 * brightness), 
        b: Math.floor(128 * brightness), 
        brightness: brightness 
      });
      continue;
    }
    
    // Extract segment for FFT
    const fftSegment = new Float32Array(fftSize);
    for (let i = 0; i < fftSize && (startSample + i) < length; i++) {
      fftSegment[i] = channelData[startSample + i];
    }
    
    // Calculate RMS for brightness (use full segment)
    let rms = 0;
    for (let i = startSample; i < endSample; i++) {
      rms += channelData[i] * channelData[i];
    }
    rms = Math.sqrt(rms / segmentLength);
    const brightness = Math.min(1, rms * 2);
    
    // Perform FFT on segment
    const fftResult = performFFT(fftSegment);
    
    // Calculate energy in frequency bands (optimized)
    let lowEnergy = 0;
    let midEnergy = 0;
    let highEnergy = 0;
    
    for (let i = 1; i < fftSize / 2; i++) {
      const magnitude = fftResult[i];
      
      if (i <= lowBinMax) {
        lowEnergy += magnitude;
      } else if (i >= midBinMin && i <= midBinMax) {
        midEnergy += magnitude;
      } else if (i >= highBinMin) {
        highEnergy += magnitude;
      }
    }
    
    // Normalize energies
    const totalEnergy = lowEnergy + midEnergy + highEnergy;
    if (totalEnergy > 0) {
      lowEnergy /= totalEnergy;
      midEnergy /= totalEnergy;
      highEnergy /= totalEnergy;
    }
    
    // Map to colors
    // Red/Orange for low frequencies
    const r = Math.min(255, Math.floor(lowEnergy * 255 + (midEnergy * 100)));
    // Green for mid frequencies
    const g = Math.min(255, Math.floor(midEnergy * 255));
    // Blue for high frequencies
    const b = Math.min(255, Math.floor(highEnergy * 255 + (midEnergy * 50)));
    
    // Apply brightness (RMS) to colors
    const brightnessFactor = 0.3 + brightness * 0.7; // Range: 0.3-1.0
    
    segments.push({
      r: Math.floor(r * brightnessFactor),
      g: Math.floor(g * brightnessFactor),
      b: Math.floor(b * brightnessFactor),
      brightness: brightness,
    });
  }
  
  return segments;
}

// Simple FFT implementation using DFT
function performFFT(signal: Float32Array): Float32Array {
  const N = signal.length;
  const fft = new Float32Array(N);
  
  for (let k = 0; k < N / 2; k++) {
    let real = 0;
    let imag = 0;
    
    for (let n = 0; n < N; n++) {
      const angle = (2 * Math.PI * k * n) / N;
      real += signal[n] * Math.cos(angle);
      imag -= signal[n] * Math.sin(angle);
    }
    
    // Magnitude
    fft[k] = Math.sqrt(real * real + imag * imag);
    if (k > 0 && k < N / 2) {
      fft[N - k] = fft[k]; // Mirror for negative frequencies
    }
  }
  
  return fft;
}

export default function FileInput() {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [timing, setTiming] = useState<{
    decodeTime?: number;
    bpmTime?: number;
    totalTime?: number;
  }>({});
  const [audioData, setAudioData] = useState<{
    duration: number;
    bpm: number;
    downbeatTime: number;
    key?: { key: string; scale: 'major' | 'minor'; camelot: string };
    waveform?: WaveformSegment[];
  } | null>(null);

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
    setLoadingStep('Decoding audio file...');
    setError(null);
    setTiming({});
    setAudioData(null);

    const totalStartTime = performance.now();

    try {
      // Measure decode time
      console.log('Starting audio decode...');
      setLoadingStep('Decoding audio file...');
      const decodeStartTime = performance.now();
      const audioBuffer = await decodeAudio(file);
      const decodeEndTime = performance.now();
      const decodeTime = decodeEndTime - decodeStartTime;
      
      console.log('Audio duration:', audioBuffer.duration, 'seconds');
      console.log('Sample rate:', audioBuffer.sampleRate, 'Hz');
      console.log('Number of channels:', audioBuffer.numberOfChannels);
      console.log('Decode time:', decodeTime.toFixed(2), 'ms');
      
      // BPM detection
      console.log('Starting BPM detection...');
      setLoadingStep('Detecting BPM...');
      const bpmStartTime = performance.now();
      let bpm: number;
      try {
        bpm = detectBPM(audioBuffer);
      } catch (bpmError) {
        console.error('Error in BPM detection:', bpmError);
        throw new Error(`BPM detection failed: ${bpmError instanceof Error ? bpmError.message : 'Unknown error'}`);
      }
      const bpmEndTime = performance.now();
      const bpmTime = bpmEndTime - bpmStartTime;
      console.log('BPM detection completed in', bpmTime.toFixed(2), 'ms');
      
      // Downbeat detection
      console.log('Starting downbeat detection...');
      setLoadingStep('Detecting downbeat...');
      let downbeatTime: number;
      try {
        downbeatTime = detectDownbeat(audioBuffer, bpm);
        console.log('Downbeat detected at:', downbeatTime.toFixed(3), 'seconds');
      } catch (downbeatError) {
        console.error('Error in downbeat detection:', downbeatError);
        // Use 0 as fallback
        downbeatTime = 0;
      }
      
      // Key detection
      console.log('Starting key detection...');
      setLoadingStep('Detecting key...');
      let keyResult: { key: string; scale: 'major' | 'minor'; camelot: string };
      try {
        keyResult = detectKey(audioBuffer);
        console.log('Detected key:', keyResult.key, keyResult.scale, `(Camelot: ${keyResult.camelot})`);
      } catch (keyError) {
        console.error('Error in key detection:', keyError);
        // Use default fallback
        keyResult = { key: 'C', scale: 'major', camelot: '8B' };
      }
      
      // Waveform analysis
      console.log('Starting waveform analysis...');
      setLoadingStep('Analyzing waveform...');
      let waveformData: WaveformSegment[] = [];
      try {
        waveformData = analyzeWaveform(audioBuffer, 800); // 800 pixels wide
        console.log('Waveform analysis completed:', waveformData.length, 'segments');
      } catch (waveformError) {
        console.error('Error in waveform analysis:', waveformError);
        // Continue without waveform
      }
      
      const totalEndTime = performance.now();
      const totalTime = totalEndTime - totalStartTime;
      
      console.log('BPM detection time:', bpmTime.toFixed(2), 'ms');
      console.log('Total processing time:', totalTime.toFixed(2), 'ms');
      console.log('Detected BPM:', bpm);
      
      setTiming({
        decodeTime: Math.round(decodeTime),
        bpmTime: Math.round(bpmTime),
        totalTime: Math.round(totalTime),
      });
      
      setAudioData({
        duration: audioBuffer.duration,
        bpm,
        downbeatTime,
        key: keyResult,
        waveform: waveformData.length > 0 ? waveformData : undefined,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process audio file';
      setError(errorMessage);
      console.error('Error processing audio:', err);
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
        <div className="flex flex-col gap-2">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {loadingStep}
          </p>
          <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-2">
            <div className="bg-zinc-950 dark:bg-zinc-50 h-2 rounded-full animate-pulse" style={{ width: '100%' }}></div>
          </div>
        </div>
      )}
      
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      
      {!isLoading && timing.totalTime && (
        <div className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
          <p>Decode time: {timing.decodeTime}ms</p>
          <p>BPM detection time: {timing.bpmTime}ms</p>
          <p className="font-medium">Total time: {timing.totalTime}ms</p>
        </div>
      )}
      
      {audioData && (
        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Analysis Results
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-zinc-500 dark:text-zinc-400">BPM</p>
                <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  {audioData.bpm}
                </p>
              </div>
              {audioData.key && (
                <div>
                  <p className="text-zinc-500 dark:text-zinc-400">Key</p>
                  <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                    {audioData.key.key} {audioData.key.scale}
                  </p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">
                    Camelot: {audioData.key.camelot}
                  </p>
                </div>
              )}
            </div>
          </div>
          
          {audioData.waveform && audioData.waveform.length > 0 ? (
            <WaveformCanvas
              waveform={audioData.waveform}
              duration={audioData.duration}
              bpm={audioData.bpm}
              downbeatTime={audioData.downbeatTime}
            />
          ) : (
            <Beatgrid
              duration={audioData.duration}
              bpm={audioData.bpm}
              downbeatTime={audioData.downbeatTime}
            />
          )}
        </div>
      )}
    </div>
  );
}

