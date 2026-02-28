"use client";

import { useState, useRef } from "react";
import { Play, Square, SkipBack, Download, Loader2, RotateCcw, Repeat, Volume2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Slider } from "@/components/ui/slider";
import { useTracksStore } from "@/store/tracks";
import { mixer } from "@/lib/mixer";

export default function TransportBar() {
  const { tracks, analysis, isPlaying, setPlaying, reset } = useTracksStore();
  const [isExporting, setIsExporting] = useState(false);
  const [masterVolume, setMasterVolume] = useState(0.8);
  const [isLooping, setIsLooping] = useState(false);
  const isLoopingRef = useRef(false);

  const toggleLoop = () => {
    const next = !isLooping;
    setIsLooping(next);
    isLoopingRef.current = next;
  };

  const handlePlayStop = () => {
    if (isPlaying) {
      mixer.stop();
      setPlaying(false);
    } else {
      setPlaying(true);
      const onEnd = () => {
        if (isLoopingRef.current) {
          mixer.seekTo(tracks, 0, onEnd);
        } else {
          setPlaying(false);
        }
      };
      mixer.play(tracks, onEnd, mixer.currentPosition);
    }
  };

  const handleRewind = () => {
    if (isPlaying) {
      const onEnd = () => {
        isLoopingRef.current ? mixer.seekTo(tracks, 0, onEnd) : setPlaying(false);
      };
      mixer.seekTo(tracks, 0, onEnd);
    } else {
      mixer.stop();
      mixer.setPosition(0);
      setPlaying(false);
    }
  };

  const handleNewSession = () => {
    mixer.stop();
    mixer.setPosition(0);
    reset();
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const wavBlob = await mixer.exportMix(tracks);
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hum-producer-mix-${Date.now()}.wav`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
    }
    setIsExporting(false);
  };

  const masterDbDisplay =
    masterVolume > 0 ? `${(20 * Math.log10(masterVolume)).toFixed(0)}` : "-∞";

  return (
    <div className="flex items-center gap-3">
      {/* Transport Controls */}
      <div className="flex items-center gap-1">
        <motion.button
          onClick={handleRewind}
          whileTap={{ scale: 0.9 }}
          className="transport-btn w-8 h-8 flex items-center justify-center rounded"
          title="Rewind"
        >
          <SkipBack className="w-3.5 h-3.5 text-[#808088]" />
        </motion.button>

        <motion.button
          onClick={handlePlayStop}
          whileTap={{ scale: 0.9 }}
          className={`transport-btn w-9 h-8 flex items-center justify-center rounded ${
            isPlaying ? "!bg-[#00FF87]/10 !border-[#00FF87]/30" : ""
          }`}
          title={isPlaying ? "Stop" : "Play"}
        >
          <AnimatePresence mode="wait">
            {isPlaying ? (
              <motion.div
                key="stop"
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 90 }}
                transition={{ type: "spring", stiffness: 500, damping: 25 }}
              >
                <Square className="w-3.5 h-3.5 text-[#00FF87]" />
              </motion.div>
            ) : (
              <motion.div
                key="play"
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 90 }}
                transition={{ type: "spring", stiffness: 500, damping: 25 }}
              >
                <Play className="w-3.5 h-3.5 text-[#E0E0E4] ml-0.5" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>

        <motion.button
          onClick={toggleLoop}
          whileTap={{ scale: 0.9 }}
          title={isLooping ? "Loop on" : "Loop off"}
          className={`transport-btn w-8 h-8 flex items-center justify-center rounded ${
            isLooping ? "!bg-[#00D4FF]/10 !border-[#00D4FF]/30" : ""
          }`}
        >
          <Repeat
            className="w-3.5 h-3.5"
            style={{ color: isLooping ? "#00D4FF" : "#808088" }}
          />
        </motion.button>

        <motion.button
          onClick={handleExport}
          disabled={isExporting}
          whileTap={{ scale: 0.9 }}
          className="transport-btn w-8 h-8 flex items-center justify-center rounded"
          title="Export WAV"
        >
          {isExporting ? (
            <Loader2 className="w-3.5 h-3.5 text-[#808088] animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5 text-[#808088]" />
          )}
        </motion.button>

        <div className="w-px h-5 bg-[#2A2A2E]" />

        <motion.button
          onClick={handleNewSession}
          whileTap={{ scale: 0.9 }}
          className="transport-btn w-8 h-8 flex items-center justify-center rounded"
          title="New session — re-record hum"
        >
          <RotateCcw className="w-3.5 h-3.5 text-[#808088]" />
        </motion.button>
      </div>

      {/* Master Volume */}
      <div className="w-px h-5 bg-[#2A2A2E]" />
      <div className="flex items-center gap-1.5">
        <Volume2 className="w-3 h-3 text-[#505058]" />
        <div style={{ width: 64 }}>
          <Slider
            value={[masterVolume * 100]}
            min={0}
            max={100}
            step={1}
            onValueChange={([v]) => {
              const vol = v / 100;
              setMasterVolume(vol);
              mixer.setMasterVolume(vol);
            }}
          />
        </div>
        <div className="lcd-display px-1.5 py-0.5 min-w-[32px] text-center">
          <span className="text-[9px] font-[tabular-nums] text-[#00FF87]">
            {masterDbDisplay}
          </span>
        </div>
      </div>

      {/* Analysis LCD Readouts */}
      {analysis && (
        <>
          <div className="w-px h-5 bg-[#2A2A2E]" />
          <div className="flex items-center gap-2">
            {[
              { label: "Key", value: analysis.key, className: "led-cyan" },
              { label: "BPM", value: analysis.tempo, className: "led-green font-[tabular-nums]" },
              { label: "Mood", value: analysis.mood, className: "led-purple" },
              { label: "Genre", value: analysis.genre, className: "led-amber" },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                className="lcd-display px-2 py-0.5 flex items-center gap-1.5"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08, type: "spring", stiffness: 400, damping: 25 }}
              >
                <span className="text-[9px] text-[#505058] uppercase">{item.label}</span>
                <span className={`text-[11px] font-medium ${item.className}`}>{item.value}</span>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
