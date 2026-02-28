"use client";

import HumRecorder from "@/components/HumRecorder";
import TrackList from "@/components/TrackList";
import MasterTrack from "@/components/MasterTrack";
import VoiceCommandBar from "@/components/VoiceCommandBar";
import TextCommandBar from "@/components/TextCommandBar";
import TransportBar from "@/components/TransportBar";
import { useTracksStore } from "@/store/tracks";

export default function Home() {
  const { step } = useTracksStore();

  return (
    <div className="h-screen flex flex-col bg-[#0D0D0F] overflow-hidden">
      {/* Top Bar - Header & Transport */}
      <header className="shrink-0 border-b border-[#2A2A2E] bg-[#1A1A1E]">
        <div className="flex items-center justify-between px-4 h-12">
          {/* Left: Logo */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#00FF87] shadow-[0_0_6px_#00FF87]" />
              <div className="w-2 h-2 rounded-full bg-[#00D4FF] shadow-[0_0_6px_#00D4FF]" />
              <div className="w-2 h-2 rounded-full bg-[#A855F7] shadow-[0_0_6px_#A855F7]" />
            </div>
            <h1 className="font-[family-name:var(--font-display)] text-sm font-bold tracking-[0.12em] uppercase text-[#E0E0E4]">
              Hum Producer
            </h1>
          </div>

          {/* Center: Transport (only in studio) */}
          {step === "studio" && <TransportBar />}

          {/* Right: Info */}
          <div className="flex items-center gap-4">
            <div className="lcd-display px-2.5 py-1 flex items-center gap-2">
              <span className="text-[10px] text-[#505058] uppercase tracking-wider">Status</span>
              <span className={`text-[10px] font-medium ${
                step === "studio" ? "led-green" : step === "record" ? "text-[#808088]" : "led-amber"
              }`}>
                {step === "record" ? "READY" : step === "analyzing" ? "ANALYZING" : step === "generating" ? "GENERATING" : "ONLINE"}
              </span>
            </div>
            <span className="text-[9px] text-[#505058] tracking-wider uppercase">
              ListenHacks 2025
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {step !== "studio" ? (
          <div className="h-full flex items-center justify-center">
            <HumRecorder />
          </div>
        ) : (
          <div className="h-full flex flex-col">
            {/* Master + Mixer Area */}
            <div className="flex-1 overflow-auto px-3 py-3">
              <MasterTrack />
              <TrackList />
            </div>

            {/* Bottom: Command Input */}
            <div className="shrink-0 border-t border-[#2A2A2E] bg-[#1A1A1E] px-3 py-3">
              <div className="max-w-5xl mx-auto flex gap-3">
                <div className="flex-1">
                  <TextCommandBar />
                </div>
                <VoiceCommandBar />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
