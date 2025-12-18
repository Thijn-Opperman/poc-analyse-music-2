'use client';

import { useState } from 'react';
import WaveformCanvas from './WaveformCanvas';
import {
  decodeAudio,
  detectBPM,
  detectDownbeat,
  detectKey,
  analyzeWaveform,
  type WaveformSegment,
} from './FileInput';

export default function Analyzer() {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [audioData, setAudioData] = useState<{
    duration: number;
    bpm: number;
    downbeatTime: number;
    key: { key: string; scale: 'major' | 'minor'; camelot: string };
    waveform: WaveformSegment[];
  } | null>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type
    const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave'];
    const fileExtension = file.name.toLowerCase().split('.').pop();
    const isValidType =
      validTypes.includes(file.type) ||
      fileExtension === 'mp3' ||
      fileExtension === 'wav';

    if (!isValidType) {
      setError('Please upload an MP3 or WAV file');
      return;
    }

    setIsLoading(true);
    setLoadingStep('Uploading and decoding audio...');
    setError(null);
    setAudioData(null);

    try {
      // Step 1: Upload → decodeAudio
      console.log('Step 1: Decoding audio...');
      const audioBuffer = await decodeAudio(file);
      console.log('Audio decoded:', {
        duration: audioBuffer.duration,
        sampleRate: audioBuffer.sampleRate,
        channels: audioBuffer.numberOfChannels,
      });

      // Step 2: detectBPM → beatgrid
      console.log('Step 2: Detecting BPM...');
      setLoadingStep('Detecting BPM...');
      const bpm = detectBPM(audioBuffer);
      const downbeatTime = detectDownbeat(audioBuffer, bpm);
      console.log('BPM detected:', bpm, 'Downbeat at:', downbeatTime);

      // Step 3: detectKey → log
      console.log('Step 3: Detecting key...');
      setLoadingStep('Detecting key...');
      const key = detectKey(audioBuffer);
      console.log('Key detected:', key);

      // Step 4: generateWaveform + freq + RMS
      console.log('Step 4: Generating waveform with frequency analysis...');
      setLoadingStep('Generating waveform...');
      const waveform = analyzeWaveform(audioBuffer, 800);
      console.log('Waveform generated:', waveform.length, 'segments');

      // Step 5: Console output
      console.log('BPM:', bpm, 'Key:', key.key, key.scale, `(Camelot: ${key.camelot})`);

      // Step 6: Set data for rendering
      setAudioData({
        duration: audioBuffer.duration,
        bpm,
        downbeatTime,
        key,
        waveform,
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to process audio file';
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
            <div
              className="bg-zinc-950 dark:bg-zinc-50 h-2 rounded-full animate-pulse"
              style={{ width: '100%' }}
            ></div>
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
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
              <div>
                <p className="text-zinc-500 dark:text-zinc-400">Key</p>
                <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  {audioData.key.key} {audioData.key.scale}
                </p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500">
                  Camelot: {audioData.key.camelot}
                </p>
              </div>
            </div>
          </div>

          {/* Step 6: Render Canvas - waveform + kleuren + beatgrid */}
          <div className="w-full overflow-x-auto">
            <WaveformCanvas
              waveform={audioData.waveform}
              duration={audioData.duration}
              bpm={audioData.bpm}
              downbeatTime={audioData.downbeatTime}
            />
          </div>
        </div>
      )}
    </div>
  );
}

