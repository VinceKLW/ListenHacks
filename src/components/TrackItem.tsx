"use client";

import { useRef, useEffect } from "react";
import { motion } from "motion/react";
import { Trash2, Mic } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Track } from "@/types/music";
import { useTracksStore } from "@/store/tracks";
import { mixer } from "@/lib/mixer";
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
};

const typeColors: Record<string, string> = {
  hum: "#A855F7",
  arrangement: "#00D4FF",
  beat: "#FFB800",
  instrument: "#00FF87",
  midi: "#06b6d4",
};

export default function TrackItem({ track, onOpenHumModal }: TrackItemProps) {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const { tracks, isPlaying, updateTrack, removeTrack, selectedTrackId, setSelectedTrackId } = useTracksStore();
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
  }, [track.audioBuffer, track.color, track.type]);

  const color = typeColors[track.type] || track.color;
  const dbValue = track.volume > 0 ? (20 * Math.log10(track.volume)).toFixed(1) : "-inf";

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
          <span
            className="text-[9px] uppercase tracking-wider font-semibold"
            style={{ color: color }}
          >
            {typeLabels[track.type]}
          </span>
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
      <div className="flex-1 min-w-0 daw-panel-recessed rounded px-2 py-1">
        {track.isLoading ? (
          <div className="flex items-center justify-center h-10 gap-2">
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
        ) : (
          <div ref={waveformRef} className="w-full" />
        )}
      </div>

      {/* Controls */}
      <div className="w-[260px] shrink-0 flex items-center gap-2">
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
