"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "motion/react";
import { Trash2, Mic, Play, Square } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Track } from "@/types/music";
import { useTracksStore } from "@/store/tracks";
import { mixer } from "@/lib/mixer";
import { getAudioContext } from "@/lib/audio-utils";
import WaveSurfer from "wavesurfer.js";

interface TrackItemProps {
  track: Track;
  onOpenHumModal?: () => void;
}

const typeLabels: Record<string, string> = {
  hum: "HUM",
  arrangement: "ARR",
  beat: "BEAT",
  instrument: "INST",
  midi: "MIDI",
  vocal: "VOX",
};

const typeColors: Record<string, string> = {
  hum: "#A855F7",
  arrangement: "#00D4FF",
  beat: "#FFB800",
  instrument: "#00FF87",
  midi: "#06b6d4",
  vocal: "#F97316",
};

export default function TrackItem({ track, onOpenHumModal }: TrackItemProps) {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const previewSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const { tracks, isPlaying, updateTrack, removeTrack, selectedTrackId, setSelectedTrackId, timeSelections, addTimeSelection } =
    useTracksStore();
  const isSelected = selectedTrackId === track.id;

  useEffect(() => {
    if (!waveformRef.current || !track.audioBuffer) return;

    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
    }

    const color = typeColors[track.type] || track.color;

    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: color + "50",
      progressColor: color,
      cursorColor: "transparent",
      barWidth: 2,
      barGap: 1,
      barRadius: 1,
      height: 40,
      interact: false,
      normalize: true,
    });

    const channelData = track.audioBuffer.getChannelData(0);
    ws.load("", [channelData], track.audioBuffer.duration);

    wavesurferRef.current = ws;

    return () => {
      ws.destroy();
    };
  }, [track.audioBuffer, track.color, track.type, track.startOffset]);

  // Stop preview on unmount
  useEffect(() => {
    return () => {
      try { previewSourceRef.current?.stop(); } catch { /* already stopped */ }
    };
  }, []);

  const handlePreviewToggle = () => {
    if (isPreviewPlaying) {
      try { previewSourceRef.current?.stop(); } catch { /* already stopped */ }
      previewSourceRef.current = null;
      setIsPreviewPlaying(false);
      return;
    }
    if (!track.audioBuffer) return;
    const ctx = getAudioContext();
    const source = ctx.createBufferSource();
    const panner = ctx.createStereoPanner();
    const gain = ctx.createGain();
    source.buffer = track.audioBuffer;
    panner.pan.value = track.pan ?? 0;
    gain.gain.value = track.volume;
    source.connect(panner).connect(gain).connect(ctx.destination);
    source.start(0);
    source.onended = () => {
      previewSourceRef.current = null;
      setIsPreviewPlaying(false);
    };
    previewSourceRef.current = source;
    setIsPreviewPlaying(true);
  };

  const sessionDuration = mixer.getDuration(tracks);
  const startOff = track.startOffset ?? 0;
  const audioDur = track.audioBuffer?.duration ?? 0;
  const clipLeftPct = sessionDuration > 0 ? (startOff / sessionDuration) * 100 : 0;
  const clipWidthPct =
    sessionDuration > 0 && audioDur > 0 ? (audioDur / sessionDuration) * 100 : 100;

  const color = typeColors[track.type] || track.color;
  const dbValue = track.volume > 0 ? (20 * Math.log10(track.volume)).toFixed(1) : "-inf";
  const panValue = track.pan ?? 0;
  const panLabel =
    Math.abs(panValue) < 0.01
      ? "C"
      : panValue > 0
      ? `R${Math.round(panValue * 100)}`
      : `L${Math.round(Math.abs(panValue) * 100)}`;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setSelectedTrackId(isSelected ? null : track.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setSelectedTrackId(isSelected ? null : track.id);
        }
      }}
      className={`flex items-center gap-2 px-3 py-2 transition-opacity cursor-pointer ${
        track.muted ? "opacity-40" : ""
      } ${isSelected ? "ring-1 ring-[#00D4FF] ring-inset" : ""}`}
      style={{ backgroundColor: track.muted ? "#131316" : isSelected ? "#1E2934" : "#1A1A1E" }}
    >
      {/* Channel Info */}
      <div className="w-[140px] shrink-0 flex items-center gap-2">
        {/* Color indicator bar */}
        <motion.div
          className="w-1 h-8 rounded-full shrink-0"
          style={{
            backgroundColor: color,
            boxShadow: `0 0 6px ${color}40`,
          }}
          animate={track.muted ? { opacity: 0.3 } : { opacity: 1 }}
        />

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-[#E0E0E4] truncate leading-tight">
            {track.name}
          </p>
          <div className="flex items-center gap-1">
            <span
              className="text-[9px] uppercase tracking-wider font-semibold"
              style={{ color: color }}
            >
              {typeLabels[track.type]}
            </span>
            {timeSelections.some((s) => s.trackId === track.id) && (
              <div
                className="w-1 h-1 rounded-full"
                style={{ backgroundColor: "#00D4FF", boxShadow: "0 0 4px #00D4FF" }}
                title="Time selection active"
              />
            )}
          </div>
        </div>

        {track.type === "hum" && onOpenHumModal && (
          <motion.button
            whileTap={{ scale: 0.88 }}
            whileHover={{ scale: 1.1 }}
            onClick={onOpenHumModal}
            title="Regenerate hum"
            className="w-5 h-5 flex items-center justify-center rounded bg-[#232328] border border-[#2A2A2E] text-[#A855F7]/60 hover:text-[#A855F7] hover:border-[#A855F7]/30 transition-colors shrink-0"
          >
            <Mic className="w-3 h-3" />
          </motion.button>
        )}
      </div>

      {/* Waveform Display */}
      <div
        className="flex-1 min-w-0 daw-panel-recessed rounded relative overflow-hidden"
        style={{ height: 52 }}
      >
        {track.isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center gap-2">
            <div className="flex gap-[2px]">
              {[14, 22, 10, 20, 16, 24, 12, 18].map((h, i) => (
                <motion.div
                  key={i}
                  className="w-1 bg-[#00D4FF] rounded-full"
                  animate={{ height: [4, h, 4], opacity: [0.2, 0.4, 0.2] }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: i * 0.12,
                  }}
                />
              ))}
            </div>
            <span className="text-[9px] text-[#505058] uppercase tracking-wider">
              Generating...
            </span>
          </div>
        ) : !track.audioBuffer ? (
          <div className="absolute inset-0 flex items-center justify-center gap-1.5">
            <span className="text-[9px] uppercase tracking-wider text-[#FF3B30]/60">Generation failed</span>
          </div>
        ) : (
          <>
            {/* Clip block — positioned by session time (Ableton-style) */}
            {track.audioBuffer && (
              <div
                className="absolute top-[6px] bottom-[6px] rounded overflow-hidden"
                style={{
                  left: `${clipLeftPct}%`,
                  width: `${Math.max(clipWidthPct, 0.8)}%`,
                  backgroundColor: `${color}08`,
                  borderLeft: `2px solid ${color}50`,
                }}
              >
                <div ref={waveformRef} style={{ width: "100%", height: "100%" }} />
              </div>
            )}

            {/* Selection overlays — session-absolute positioning */}
            {track.audioBuffer && timeSelections
              .filter((s) => s.trackId === track.id)
              .map((sel) => {
                const refDur = sessionDuration > 0 ? sessionDuration : track.audioBuffer!.duration;
                const leftPct = Math.max(0, (sel.start / refDur) * 100);
                const wPct = Math.min(100 - leftPct, ((sel.end - sel.start) / refDur) * 100);
                return (
                  <div
                    key={sel.id}
                    className="absolute top-0 bottom-0 pointer-events-none z-10 rounded"
                    style={{
                      left: `${leftPct}%`,
                      width: `${wPct}%`,
                      background: "rgba(0,212,255,0.15)",
                      borderLeft: "1.5px solid rgba(0,212,255,0.8)",
                      borderRight: "1.5px solid rgba(0,212,255,0.8)",
                    }}
                  />
                );
              })}

            {/* Drag-to-select hit area — stores session-absolute times */}
            <div
              className="absolute inset-0 cursor-crosshair z-20 hover:bg-white/[0.03] transition-colors"
              title="Drag to select a time range"
              onMouseDown={(e) => {
                e.stopPropagation();
                const refDur = sessionDuration > 0 ? sessionDuration : (track.audioBuffer?.duration ?? 0);
                if (refDur <= 0) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const startX = e.clientX - rect.left;
                let didDrag = false;

                const handleMouseMove = (ev: MouseEvent) => {
                  if (!didDrag && Math.abs(ev.clientX - rect.left - startX) > 4) didDrag = true;
                };

                const handleMouseUp = (ev: MouseEvent) => {
                  window.removeEventListener("mousemove", handleMouseMove);
                  window.removeEventListener("mouseup", handleMouseUp);
                  if (didDrag) {
                    const endX = ev.clientX - rect.left;
                    const startSec = Math.max(0, (Math.min(startX, endX) / rect.width) * refDur);
                    const endSec = Math.min(refDur, (Math.max(startX, endX) / rect.width) * refDur);
                    addTimeSelection({ start: startSec, end: endSec, trackId: track.id });
                  }
                };

                window.addEventListener("mousemove", handleMouseMove);
                window.addEventListener("mouseup", handleMouseUp);
              }}
            />
          </>
        )}
      </div>

      {/* Controls */}
      <div className="w-[360px] shrink-0 flex items-center gap-2">
        {/* Preview Play Button */}
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={handlePreviewToggle}
          disabled={!track.audioBuffer || track.isLoading}
          title={isPreviewPlaying ? "Stop preview" : "Preview track"}
          className={`w-7 h-6 rounded flex items-center justify-center transition-all ${
            isPreviewPlaying
              ? "bg-[#00FF87]/15 text-[#00FF87] border border-[#00FF87]/30 shadow-[0_0_6px_rgba(0,255,135,0.2)]"
              : "bg-[#232328] text-[#808088] border border-[#2A2A2E] hover:text-[#00FF87] hover:border-[#00FF87]/20 disabled:opacity-30"
          }`}
        >
          {isPreviewPlaying ? (
            <Square className="w-2.5 h-2.5 fill-current" />
          ) : (
            <Play className="w-2.5 h-2.5 fill-current ml-0.5" />
          )}
        </motion.button>

        {/* Mute Button */}
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={(e) => {
            e.stopPropagation();
            const newMuted = !track.muted;
            updateTrack(track.id, { muted: newMuted });
            if (isPlaying) {
              const updatedTracks = tracks.map((t) =>
                t.id === track.id ? { ...t, muted: newMuted } : t
              );
              mixer.updateMuteSolo(updatedTracks);
            }
          }}
          className={`w-7 h-6 rounded text-[9px] font-bold uppercase tracking-wider transition-all ${
            track.muted
              ? "bg-[#FF3B30]/20 text-[#FF3B30] border border-[#FF3B30]/30 shadow-[0_0_6px_rgba(255,59,48,0.2)]"
              : "bg-[#232328] text-[#808088] border border-[#2A2A2E] hover:text-[#E0E0E4]"
          }`}
        >
          M
        </motion.button>

        {/* Solo Button */}
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={(e) => {
            e.stopPropagation();
            const newSolo = !track.solo;
            updateTrack(track.id, { solo: newSolo });
            if (isPlaying) {
              const updatedTracks = tracks.map((t) =>
                t.id === track.id ? { ...t, solo: newSolo } : t
              );
              mixer.updateMuteSolo(updatedTracks);
            }
          }}
          className={`w-7 h-6 rounded text-[9px] font-bold uppercase tracking-wider transition-all ${
            track.solo
              ? "bg-[#FFB800]/20 text-[#FFB800] border border-[#FFB800]/30 shadow-[0_0_6px_rgba(255,184,0,0.2)]"
              : "bg-[#232328] text-[#808088] border border-[#2A2A2E] hover:text-[#E0E0E4]"
          }`}
        >
          S
        </motion.button>

        {/* Pan Control */}
        <div className="flex flex-col items-center gap-0.5 shrink-0" style={{ width: 56 }}>
          <div className="flex items-center gap-0.5 w-full">
            <span className="text-[7px] text-[#505058] uppercase">L</span>
            <div className="flex-1 channel-fader">
              <Slider
                value={[panValue * 50 + 50]}
                min={0}
                max={100}
                step={1}
                onValueChange={([v]) => {
                  const p = (v - 50) / 50;
                  updateTrack(track.id, { pan: p });
                  mixer.setPan(track.id, p);
                }}
              />
            </div>
            <span className="text-[7px] text-[#505058] uppercase">R</span>
          </div>
          <button
            onClick={() => {
              updateTrack(track.id, { pan: 0 });
              mixer.setPan(track.id, 0);
            }}
            title="Center pan"
            className="text-[7px] text-[#505058] hover:text-[#00FF87] transition-colors leading-none"
          >
            {panLabel}
          </button>
        </div>

        {/* Volume Fader */}
        <div className="flex-1 flex items-center gap-2 channel-fader" onClick={(e) => e.stopPropagation()}>
          <Slider
            value={[track.volume * 100]}
            max={100}
            step={1}
            onValueChange={([val]) => {
              updateTrack(track.id, { volume: val / 100 });
              mixer.setVolume(track.id, val / 100);
            }}
            className="w-full"
          />
        </div>

        {/* dB Readout */}
        <div className="lcd-display px-1.5 py-0.5 min-w-[42px] text-center">
          <span className="text-[9px] font-[tabular-nums] text-[#00FF87]">
            {dbValue === "-Infinity" ? "-inf" : `${dbValue}`}
          </span>
        </div>

        {/* Delete */}
        <motion.button
          whileTap={{ scale: 0.88 }}
          whileHover={{ borderColor: "rgba(255, 59, 48, 0.3)" }}
          onClick={(e) => {
            e.stopPropagation();
            removeTrack(track.id);
          }}
          className="w-6 h-6 flex items-center justify-center rounded bg-[#232328] border border-[#2A2A2E] text-[#505058] hover:text-[#FF3B30] transition-colors"
        >
          <Trash2 className="w-3 h-3" />
        </motion.button>
      </div>
    </div>
  );
}
