'use client';

import { useEffect, useRef } from 'react';
import type { WaveformSegment } from './FileInput';

interface WaveformCanvasProps {
  waveform: WaveformSegment[];
  duration: number;
  bpm: number;
  downbeatTime: number;
  width?: number;
  height?: number;
}

export default function WaveformCanvas({
  waveform,
  duration,
  bpm,
  downbeatTime,
  width = 1200,
  height = 500,
}: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || waveform.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw waveform first (background layer)
    const centerY = height / 2;
    const pixelWidth = width / waveform.length;

    // Draw waveform bars
    for (let i = 0; i < waveform.length; i++) {
      const segment = waveform[i];
      const x = i * pixelWidth;

      // Calculate amplitude based on brightness
      const amplitude = segment.brightness * (height / 2);

      // Set color
      ctx.fillStyle = `rgb(${segment.r}, ${segment.g}, ${segment.b})`;
      ctx.strokeStyle = `rgb(${segment.r}, ${segment.g}, ${segment.b})`;

      // Draw vertical bar representing the waveform
      if (pixelWidth > 1) {
        ctx.fillRect(x, centerY - amplitude, pixelWidth, amplitude * 2);
      } else {
        // Draw line if pixel width is too small
        ctx.beginPath();
        ctx.moveTo(x, centerY - amplitude);
        ctx.lineTo(x, centerY + amplitude);
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Draw beatgrid on top (foreground layer)
    const secondsPerBeat = 60 / bpm;
    const pixelsPerSecond = width / duration;

    // Calculate beat positions starting from downbeat
    const beats: { time: number; isDownbeat: boolean }[] = [];

    // Start from downbeat and add beats forward
    let currentTime = downbeatTime;
    let beatIndex = 0;

    while (currentTime < duration) {
      beats.push({
        time: currentTime,
        isDownbeat: beatIndex % 4 === 0,
      });
      currentTime += secondsPerBeat;
      beatIndex++;
    }

    // Also add beats before downbeat if needed
    currentTime = downbeatTime - secondsPerBeat;
    beatIndex = -1;

    while (currentTime >= 0) {
      beats.unshift({
        time: currentTime,
        isDownbeat: beatIndex % 4 === 0,
      });
      currentTime -= secondsPerBeat;
      beatIndex--;
    }

    // Draw grid lines
    beats.forEach((beat) => {
      const x = beat.time * pixelsPerSecond;

      if (beat.isDownbeat) {
        // Thicker line for downbeat
        ctx.strokeStyle = '#3b82f6'; // Blue
        ctx.lineWidth = 4;
      } else {
        // Regular line for beat
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.7)'; // Semi-transparent gray
        ctx.lineWidth = 1.5;
      }

      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    });

    // Draw time labels for downbeats (on top)
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    beats
      .filter((beat) => beat.isDownbeat)
      .forEach((beat) => {
        const x = beat.time * pixelsPerSecond;
        const minutes = Math.floor(beat.time / 60);
        const seconds = Math.floor(beat.time % 60);
        const label = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        // Draw text with shadow for better visibility
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 6;
        ctx.fillText(label, x, height - 8);
        ctx.shadowBlur = 0;
      });

    // Draw center line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();
  }, [waveform, duration, bpm, downbeatTime, width, height]);

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Waveform with Beatgrid (BPM: {bpm})
      </h3>
      <div className="border border-zinc-300 dark:border-zinc-700 rounded-lg overflow-hidden bg-black w-full">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="w-full h-auto"
        />
      </div>
      <div className="flex gap-4 text-xs text-zinc-500 dark:text-zinc-400">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-red-500"></div>
          <span>Low (0-250 Hz)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-500"></div>
          <span>Mid (250-4kHz)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-blue-500"></div>
          <span>High (4kHz+)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
          <span>Downbeats</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-gray-400"></div>
          <span>Beats</span>
        </div>
      </div>
    </div>
  );
}

