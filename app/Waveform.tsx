'use client';

import { useEffect, useRef } from 'react';
import type { WaveformSegment } from './FileInput';

interface WaveformProps {
  segments: WaveformSegment[];
  duration: number;
  width?: number;
  height?: number;
}

export default function Waveform({ 
  segments, 
  duration,
  width = 800,
  height = 200 
}: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || segments.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    const centerY = height / 2;
    const pixelWidth = width / segments.length;

    // Draw waveform
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const x = i * pixelWidth;
      
      // Calculate amplitude based on brightness
      const amplitude = segment.brightness * (height / 2);
      
      // Set color
      ctx.fillStyle = `rgb(${segment.r}, ${segment.g}, ${segment.b})`;
      ctx.strokeStyle = `rgb(${segment.r}, ${segment.g}, ${segment.b})`;
      
      // Draw vertical line representing the waveform
      ctx.beginPath();
      ctx.moveTo(x, centerY - amplitude);
      ctx.lineTo(x, centerY + amplitude);
      ctx.lineWidth = Math.max(1, pixelWidth);
      ctx.stroke();
      
      // Optional: fill area for more visual impact
      if (pixelWidth > 1) {
        ctx.fillRect(x, centerY - amplitude, pixelWidth, amplitude * 2);
      }
    }

  }, [segments, width, height]);

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Waveform (Frequency Analysis)
      </h3>
      <div className="border border-zinc-300 dark:border-zinc-700 rounded-lg overflow-hidden bg-black">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="w-full"
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
          <span>Brightness = RMS</span>
        </div>
      </div>
    </div>
  );
}

