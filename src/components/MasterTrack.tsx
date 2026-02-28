"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useTracksStore } from "@/store/tracks";
import { mixer } from "@/lib/mixer";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${m}:${String(s).padStart(2, "0")}.${ms}`;
}

export default function MasterTrack() {
  const { tracks, isPlaying, setPlaying, step } = useTracksStore();
  const [position, setPosition] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const duration = mixer.getDuration(tracks);

  // Subscribe to position updates from mixer
  useEffect(() => {
    if (!isPlaying) return;
    const unsub = mixer.onPositionUpdate((pos) => {
      if (!isDragging) setPosition(pos);
    });
    return unsub;
  }, [isPlaying, isDragging]);

  // Keep position where it is when stopped (don't reset to 0)
  // Only reset to 0 if there's no valid position from seeking


  // Draw composite waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || duration === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    ctx.clearRect(0, 0, w, h);

    // Draw grid lines
    ctx.strokeStyle = "#1A1A1E";
    ctx.lineWidth = 1;
    const gridInterval = duration > 30 ? 10 : duration > 10 ? 5 : 1;
    for (let t = gridInterval; t < duration; t += gridInterval) {
      const x = (t / duration) * w;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // Center line
    ctx.strokeStyle = "#1A1A1E";
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    // Composite all tracks
    const activeTracks = tracks.filter((t) => t.audioBuffer && !t.muted);
    if (activeTracks.length === 0) return;

    const sampleRate = activeTracks[0].audioBuffer!.sampleRate;
    const totalSamples = Math.ceil(duration * sampleRate);
    const samplesPerPixel = Math.max(1, Math.floor(totalSamples / w));

    // Mix down to mono for visualization
    const mixed = new Float32Array(totalSamples);
    activeTracks.forEach((track) => {
      const data = track.audioBuffer!.getChannelData(0);
      const vol = track.volume;
      for (let i = 0; i < Math.min(data.length, totalSamples); i++) {
        mixed[i] += data[i] * vol;
      }
    });

    // Normalize
    let peak = 0;
    for (let i = 0; i < mixed.length; i++) {
      const abs = Math.abs(mixed[i]);
      if (abs > peak) peak = abs;
    }
    if (peak > 0) {
      for (let i = 0; i < mixed.length; i++) {
        mixed[i] /= peak;
      }
    }

    // Draw waveform
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, "#00FF8760");
    gradient.addColorStop(0.3, "#00D4FF50");
    gradient.addColorStop(0.5, "#00D4FF20");
    gradient.addColorStop(0.7, "#00D4FF50");
    gradient.addColorStop(1, "#00FF8760");

    ctx.fillStyle = gradient;

    for (let x = 0; x < w; x++) {
      const start = Math.floor(x * samplesPerPixel);
      const end = Math.min(start + samplesPerPixel, mixed.length);
      let min = 0, max = 0;
      for (let i = start; i < end; i++) {
        if (mixed[i] < min) min = mixed[i];
        if (mixed[i] > max) max = mixed[i];
      }
      const yTop = ((1 - max) / 2) * h;
      const yBottom = ((1 - min) / 2) * h;
      ctx.fillRect(x, yTop, 1, yBottom - yTop);
    }
  }, [tracks, duration]);

  const handleSeek = useCallback(
    (clientX: number) => {
      if (!trackRef.current || duration === 0) return;
      const rect = trackRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const newPos = (x / rect.width) * duration;
      setPosition(newPos);
      mixer.setPosition(newPos);
      return newPos;
    },
    [duration]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const wasPlaying = isPlaying;
      setIsDragging(true);

      // Pause audio immediately while dragging
      if (wasPlaying) {
        mixer.stop();
        setPlaying(false);
      }

      handleSeek(e.clientX);

      const handleMouseMove = (ev: MouseEvent) => {
        handleSeek(ev.clientX);
      };

      const handleMouseUp = (ev: MouseEvent) => {
        handleSeek(ev.clientX);
        setIsDragging(false);
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [handleSeek, isPlaying, tracks, setPlaying]
  );

  if (step !== "studio" || duration === 0) return null;

  const progressPct = duration > 0 ? (position / duration) * 100 : 0;

  return (
    <div className="max-w-5xl mx-auto mb-2">
      <div className="flex items-center justify-between mb-1 px-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.12em] text-[#505058] font-[family-name:var(--font-display)] font-semibold">
            Master
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="lcd-display px-2 py-0.5">
            <span className="text-[10px] font-[tabular-nums] led-cyan">
              {formatTime(position)}
            </span>
          </div>
          <span className="text-[9px] text-[#505058]">/</span>
          <div className="lcd-display px-2 py-0.5">
            <span className="text-[10px] font-[tabular-nums] text-[#505058]">
              {formatTime(duration)}
            </span>
          </div>
        </div>
      </div>

      {/* Waveform + Playhead */}
      <div
        ref={trackRef}
        className="daw-panel-recessed rounded-md h-16 relative cursor-crosshair select-none overflow-hidden"
        onMouseDown={handleMouseDown}
      >
        {/* Composite waveform */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
        />

        {/* Time markers */}
        <div className="absolute bottom-0 left-0 right-0 h-3 flex items-end pointer-events-none">
          {duration > 0 &&
            Array.from(
              { length: Math.floor(duration / (duration > 30 ? 10 : duration > 10 ? 5 : 1)) + 1 },
              (_, i) => {
                const interval = duration > 30 ? 10 : duration > 10 ? 5 : 1;
                const t = i * interval;
                if (t >= duration) return null;
                const pct = (t / duration) * 100;
                return (
                  <span
                    key={i}
                    className="absolute text-[7px] text-[#3A3A42] font-[tabular-nums]"
                    style={{ left: `${pct}%`, bottom: 1 }}
                  >
                    {formatTime(t)}
                  </span>
                );
              }
            )}
        </div>

        {/* Played region overlay */}
        <div
          className="absolute top-0 bottom-0 left-0 pointer-events-none"
          style={{
            width: `${progressPct}%`,
            background: "linear-gradient(90deg, rgba(0,255,135,0.05), rgba(0,212,255,0.08))",
          }}
        />

        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-[2px] pointer-events-none z-10"
          style={{
            left: `${progressPct}%`,
            background: "#00FF87",
            boxShadow: "0 0 6px #00FF87, 0 0 12px rgba(0,255,135,0.3)",
          }}
        >
          {/* Playhead handle */}
          <div
            className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-0 h-0"
            style={{
              borderLeft: "4px solid transparent",
              borderRight: "4px solid transparent",
              borderTop: "5px solid #00FF87",
              filter: "drop-shadow(0 0 3px #00FF87)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
