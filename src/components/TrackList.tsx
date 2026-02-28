"use client";

import { AnimatePresence, motion } from "motion/react";
import { useTracksStore } from "@/store/tracks";
import TrackItem from "./TrackItem";

export default function TrackList() {
  const { tracks, step } = useTracksStore();

  if (step !== "studio") return null;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Mixer Header */}
      <motion.div
        className="flex items-center justify-between mb-2 px-1"
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.12em] text-[#505058] font-[family-name:var(--font-display)] font-semibold">
            Mixer
          </span>
          <span className="text-[10px] text-[#505058] font-[tabular-nums]">
            {tracks.length} {tracks.length === 1 ? "track" : "tracks"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="led-dot led-dot-green" />
            <span className="text-[9px] text-[#505058] uppercase tracking-wider">Signal</span>
          </div>
        </div>
      </motion.div>

      {/* Channel Strip Container */}
      <motion.div
        className="daw-panel rounded-md overflow-hidden"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.1 }}
      >
        {/* Column Headers */}
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[#2A2A2E] bg-[#151518]">
          <div className="w-[140px] shrink-0">
            <span className="text-[9px] uppercase tracking-wider text-[#505058]">Channel</span>
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[9px] uppercase tracking-wider text-[#505058]">Waveform</span>
          </div>
          <div className="w-[260px] shrink-0">
            <span className="text-[9px] uppercase tracking-wider text-[#505058]">Controls</span>
          </div>
        </div>

        {/* Tracks */}
        <div className="divide-y divide-[#1A1A1E]">
          <AnimatePresence initial={false}>
            {tracks.map((track, i) => (
              <motion.div
                key={track.id}
                initial={{ opacity: 0, height: 0, y: -8 }}
                animate={{ opacity: 1, height: "auto", y: 0 }}
                exit={{ opacity: 0, height: 0, x: -20 }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 30,
                  delay: i * 0.05,
                }}
                layout
              >
                <TrackItem track={track} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
