"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { RotateCcw, Mic, FileText } from "lucide-react";
import HumRecorder from "@/components/HumRecorder";
import TrackList from "@/components/TrackList";
import MasterTrack from "@/components/MasterTrack";
import EffectsSidebar from "@/components/EffectsSidebar";
import VoiceCommandBar from "@/components/VoiceCommandBar";
import TextCommandBar from "@/components/TextCommandBar";
import TransportBar from "@/components/TransportBar";
import HumAddModal from "@/components/HumAddModal";
import LyricsModal from "@/components/LyricsModal";
import { useTracksStore } from "@/store/tracks";

export default function Home() {
  const { step } = useTracksStore();
  const [isHumModalOpen, setIsHumModalOpen] = useState(false);
  const [isLyricsModalOpen, setIsLyricsModalOpen] = useState(false);

  return (
    <div className="h-screen flex flex-col bg-[#0D0D0F] overflow-hidden">
      {/* Top Bar - Header & Transport */}
      <header className="shrink-0 border-b border-[#2A2A2E] bg-[#1A1A1E]">
        <div className="flex items-center justify-between px-4 h-12">
          {/* Left: Logo */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <motion.div
                className="w-2 h-2 rounded-full bg-[#00FF87] shadow-[0_0_6px_#00FF87]"
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div
                className="w-2 h-2 rounded-full bg-[#00D4FF] shadow-[0_0_6px_#00D4FF]"
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
              />
              <motion.div
                className="w-2 h-2 rounded-full bg-[#A855F7] shadow-[0_0_6px_#A855F7]"
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
              />
            </div>
            <h1 className="font-[family-name:var(--font-display)] text-sm font-bold tracking-[0.12em] uppercase text-[#E0E0E4]">
              Hum Producer
            </h1>
          </div>

          {/* Center: Transport (only in studio) */}
          <AnimatePresence>
            {step === "studio" && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
              >
                <TransportBar />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Right: Info */}
          <div className="flex items-center gap-4">
            {/* Rec Hum button — studio only */}
            <AnimatePresence>
              {step === "studio" && (
                <motion.button
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  onClick={() => setIsHumModalOpen(true)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.9 }}
                  title="Regenerate hum"
                  className="flex items-center gap-1.5 px-2.5 h-7 rounded bg-[#232328] border border-[#2A2A2E] hover:bg-[#2C2C33] hover:border-[#A855F7]/40 transition-all"
                >
                  <Mic
                    className="w-3 h-3 text-[#A855F7]"
                    style={{ filter: "drop-shadow(0 0 4px #A855F780)" }}
                  />
                  <span className="text-[9px] uppercase tracking-wider font-semibold text-[#A855F7]">
                    Rec Hum
                  </span>
                </motion.button>
              )}
            </AnimatePresence>

            <div className="lcd-display px-2.5 py-1 flex items-center gap-2">
              <span className="text-[10px] text-[#505058] uppercase tracking-wider">Status</span>
              <AnimatePresence mode="wait">
                <motion.span
                  key={step}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  className={`text-[10px] font-medium ${
                    step === "studio" ? "led-green" : "text-[#808088]"
                  }`}
                >
                  {step === "studio" ? "ONLINE" : "READY"}
                </motion.span>
              </AnimatePresence>
            </div>
            <span className="text-[9px] text-[#505058] tracking-wider uppercase">
              ListenHacks 2025
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <AnimatePresence mode="wait">
          {step !== "studio" ? (
            <motion.div
              key="recorder"
              className="h-full flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              <HumRecorder />
            </motion.div>
          ) : (
            <motion.div
              key="studio"
              className="h-full flex flex-col"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              {/* Master + Mixer Area + Effects Sidebar */}
              <div className="flex-1 flex overflow-hidden">
                <div className="flex-1 overflow-auto px-3 py-3">
                  <MasterTrack />
                  <TrackList onOpenHumModal={() => setIsHumModalOpen(true)} />
                </div>
                <EffectsSidebar />
              </div>

              {/* Bottom: Command Input */}
              <motion.div
                className="shrink-0 border-t border-[#2A2A2E] bg-[#1A1A1E] px-3 py-3"
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.3 }}
              >
                <div className="max-w-5xl mx-auto flex gap-3">
                  <div className="flex-1">
                    <TextCommandBar />
                  </div>
                  <motion.button
                    onClick={() => setIsLyricsModalOpen(true)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.9 }}
                    title="Add lyrics"
                    className="w-10 h-10 rounded flex items-center justify-center bg-[#232328] border border-[#2A2A2E] hover:bg-[#2C2C33] hover:border-[#F97316]/30 transition-all shrink-0"
                  >
                    <FileText className="w-4 h-4 text-[#F97316]" />
                  </motion.button>
                  <motion.button
                    onClick={() => setIsHumModalOpen(true)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.9 }}
                    title="Regenerate hum"
                    className="w-10 h-10 rounded flex items-center justify-center bg-[#232328] border border-[#2A2A2E] hover:bg-[#2C2C33] hover:border-[#A855F7]/30 transition-all shrink-0"
                  >
                    <RotateCcw className="w-4 h-4 text-[#A855F7]" />
                  </motion.button>
                  <VoiceCommandBar />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {isHumModalOpen && (
        <HumAddModal isOpen onClose={() => setIsHumModalOpen(false)} />
      )}
      {isLyricsModalOpen && (
        <LyricsModal isOpen onClose={() => setIsLyricsModalOpen(false)} />
      )}
    </div>
  );
}
