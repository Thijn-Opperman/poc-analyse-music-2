'use client';

import { useEffect, useRef } from 'react';

interface BeatgridProps {
  duration: number;
  bpm: number;
  downbeatTime: number;
  width?: number;
  height?: number;
}

export default function Beatgrid({ 
  duration, 
  bpm, 
  downbeatTime,
  width = 800,
  height = 200 
}: BeatgridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Calculate seconds per beat
    const secondsPerBeat = 60 / bpm;
    
    // Calculate pixels per second
    const pixelsPerSecond = width / duration;
    
    // Calculate beat positions starting from downbeat
    const beats: { time: number; isDownbeat: boolean }[] = [];
    
    // Start from downbeat and add beats forward
    let currentTime = downbeatTime;
    let beatIndex = 0;
    
    while (currentTime < duration) {
      beats.push({
        time: currentTime,
        isDownbeat: beatIndex % 4 === 0
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
        isDownbeat: beatIndex % 4 === 0
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
        ctx.lineWidth = 3;
      } else {
        // Regular line for beat
        ctx.strokeStyle = '#94a3b8'; // Gray
        ctx.lineWidth = 1;
      }
      
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    });

    // Draw time labels for downbeats
    ctx.fillStyle = '#64748b';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    
    beats
      .filter(beat => beat.isDownbeat)
      .forEach((beat) => {
        const x = beat.time * pixelsPerSecond;
        const minutes = Math.floor(beat.time / 60);
        const seconds = Math.floor(beat.time % 60);
        const label = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        ctx.fillText(label, x, height - 5);
      });

  }, [duration, bpm, downbeatTime, width, height]);

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Beatgrid (BPM: {bpm})
      </h3>
      <div className="border border-zinc-300 dark:border-zinc-700 rounded-lg overflow-hidden bg-white dark:bg-zinc-900">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="w-full"
        />
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Blue lines = downbeats (every 4th beat), Gray lines = regular beats
      </p>
    </div>
  );
}

