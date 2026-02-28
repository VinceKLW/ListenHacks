"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { motion } from "motion/react";
import { useTracksStore } from "@/store/tracks";
import { mixer } from "@/lib/mixer";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${m}:${String(s).padStart(2, "0")}.${ms}`;
}

export default function MasterTrack() {
  const { tracks, isPlaying, setPlaying, step, timeSelections, addTimeSelection, removeTimeSelection } = useTracksStore();
  const [position, setPosition] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [liveSelection, setLiveSelection] = useState<{ startPct: number; endPct: number } | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const duration = mixer.getDuration(tracks);
  const masterSelections = timeSelections.filter((s) => s.trackId === null);

  // Subscribe to position updates from mixer
  useEffect(() => {
    if (!isPlaying) return;
    const unsub = mixer.onPositionUpdate((pos) => {
      if (!isDragging) setPosition(pos);
    });
    return unsub;
  }, [isPlaying, isDragging]);

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
      const trackStartSample = Math.floor((track.startOffset ?? 0) * sampleRate);
      for (let i = 0; i < data.length; i++) {
        const globalIdx = trackStartSample + i;
        if (globalIdx < totalSamples) {
          mixed[globalIdx] += data[i] * vol;
        }
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
      if (!trackRef.current || duration === 0) return;
      const rect = trackRef.current.getBoundingClientRect();
      const startX = e.clientX - rect.left;
      let dragging = false;
      setIsDragging(true);

      const handleMouseMove = (ev: MouseEvent) => {
        const curX = ev.clientX - rect.left;
        if (!dragging && Math.abs(curX - startX) > 4) dragging = true;
        if (dragging) {
          setLiveSelection({
            startPct: Math.max(0, Math.min(1, Math.min(startX, curX) / rect.width)),
            endPct: Math.max(0, Math.min(1, Math.max(startX, curX) / rect.width)),
          });
        }
      };

      const handleMouseUp = (ev: MouseEvent) => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
        setIsDragging(false);

        if (!dragging) {
          // Short click → seek only (do NOT clear selections)
          setLiveSelection(null);
          if (isPlaying) {
            mixer.stop();
            setPlaying(false);
          }
          handleSeek(ev.clientX);
        } else {
          // Drag → add new selection (accumulates)
          const curX = ev.clientX - rect.left;
          const startSec = Math.max(0, Math.min(1, Math.min(startX, curX) / rect.width)) * duration;
          const endSec = Math.max(0, Math.min(1, Math.max(startX, curX) / rect.width)) * duration;
          addTimeSelection({ start: startSec, end: endSec, trackId: null });
          setLiveSelection(null);
        }
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [duration, handleSeek, isPlaying, setPlaying, addTimeSelection]
  );

  if (step !== "studio" || duration === 0) return null;

  const progressPct = duration > 0 ? (position / duration) * 100 : 0;

  return (
    <motion.div
      className="max-w-5xl mx-auto mb-2"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
    >
      <div className="flex items-center justify-between mb-1 px-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-[0.12em] text-[#505058] font-[family-name:var(--font-display)] font-semibold">
            Master
          </span>
          {masterSelections.map((sel) => (
            <div key={sel.id} className="lcd-display px-2 py-0.5 flex items-center gap-1.5">
              <span className="text-[9px] font-[tabular-nums] text-[#00D4FF]">
                {formatTime(sel.start)} – {formatTime(sel.end)}
              </span>
              <button
                onClick={() => removeTimeSelection(sel.id)}
                className="text-[#505058] hover:text-[#FF3B30] text-[9px] leading-none transition-colors"
                title="Remove selection"
              >
                ✕
              </button>
            </div>
          ))}
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

        {/* Committed master selection overlays */}
        {masterSelections.map((sel) => (
          <div
            key={sel.id}
            className="absolute top-0 bottom-0 pointer-events-none z-20"
            style={{
              left: `${(sel.start / duration) * 100}%`,
              width: `${((sel.end - sel.start) / duration) * 100}%`,
              background: "rgba(0,212,255,0.12)",
              borderLeft: "1.5px solid rgba(0,212,255,0.7)",
              borderRight: "1.5px solid rgba(0,212,255,0.7)",
            }}
          >
            {((sel.end - sel.start) / duration) * 100 > 8 && (
              <div className="absolute top-1 left-1/2 -translate-x-1/2 lcd-display px-1 py-0 whitespace-nowrap">
                <span className="text-[8px] font-[tabular-nums] text-[#00D4FF]">
                  {formatTime(sel.end - sel.start)}
                </span>
              </div>
            )}
          </div>
        ))}

        {/* Live drag selection overlay */}
        {liveSelection && (
          <div
            className="absolute top-0 bottom-0 pointer-events-none z-20"
            style={{
              left: `${liveSelection.startPct * 100}%`,
              width: `${(liveSelection.endPct - liveSelection.startPct) * 100}%`,
              background: "rgba(0,212,255,0.10)",
              borderLeft: "1.5px solid rgba(0,212,255,0.5)",
              borderRight: "1.5px solid rgba(0,212,255,0.5)",
            }}
          >
            {(liveSelection.endPct - liveSelection.startPct) * 100 > 8 && (
              <div className="absolute top-1 left-1/2 -translate-x-1/2 lcd-display px-1 py-0 whitespace-nowrap">
                <span className="text-[8px] font-[tabular-nums] text-[#00D4FF]/60">
                  {formatTime((liveSelection.endPct - liveSelection.startPct) * duration)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-[2px] pointer-events-none z-30"
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
    </motion.div>
  );
}
