"use client";

import { Play, Square, SkipBack, Download, Loader2, RotateCcw } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTracksStore } from "@/store/tracks";
import { mixer } from "@/lib/mixer";
import { useState } from "react";

export default function TransportBar() {
  const { tracks, analysis, isPlaying, setPlaying, reset } = useTracksStore();
  const [isExporting, setIsExporting] = useState(false);

  const handlePlayStop = () => {
    if (isPlaying) {
      mixer.stop();
      setPlaying(false);
    } else {
      setPlaying(true);
      const offset = mixer.currentPosition;
      mixer.play(tracks, () => setPlaying(false), offset);
    }
  };

  const handleRewind = () => {
    if (isPlaying) {
      mixer.seekTo(tracks, 0, () => setPlaying(false));
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

  return (
    <div className="flex items-center gap-4">
      {/* Transport Controls */}
      <div className="flex items-center gap-1">
        <motion.button
          onClick={handleRewind}
          whileTap={{ scale: 0.9 }}
          className="transport-btn w-8 h-8 flex items-center justify-center rounded"
        >
          <SkipBack className="w-3.5 h-3.5 text-[#808088]" />
        </motion.button>

        <motion.button
          onClick={handlePlayStop}
          whileTap={{ scale: 0.9 }}
          className={`transport-btn w-9 h-8 flex items-center justify-center rounded ${
            isPlaying ? "!bg-[#00FF87]/10 !border-[#00FF87]/30" : ""
          }`}
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
          onClick={handleExport}
          disabled={isExporting}
          whileTap={{ scale: 0.9 }}
          className="transport-btn w-8 h-8 flex items-center justify-center rounded"
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

      {/* Analysis LCD Readouts */}
      {analysis && (
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
      )}
    </div>
  );
}
