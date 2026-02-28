"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Send, Loader2 } from "lucide-react";
import { useTracksStore } from "@/store/tracks";
import { base64ToAudioBuffer } from "@/lib/audio-utils";
import { v4 as uuidv4 } from "uuid";

export default function TextCommandBar() {
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const { step, addTrack, updateTrack } = useTracksStore();

  if (step !== "studio") return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    const description = input.trim();
    setInput("");
    setIsProcessing(true);

    const newTrackId = uuidv4();
    const isBeat =
      description.toLowerCase().includes("drum") ||
      description.toLowerCase().includes("beat") ||
      description.toLowerCase().includes("percussion") ||
      description.toLowerCase().includes("hi-hat") ||
      description.toLowerCase().includes("kick");

    addTrack({
      id: newTrackId,
      name: description,
      type: isBeat ? "beat" : "instrument",
      audioUrl: null,
      audioBuffer: null,
      volume: 0.7,
      muted: false,
      solo: false,
      color: isBeat ? "#FFB800" : "#00FF87",
      isLoading: true,
    });

    try {
      const beatRes = await fetch("/api/generate-beat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          durationSeconds: 8,
        }),
      });

      if (!beatRes.ok) throw new Error("Generation failed");
      const { audioBase64 } = await beatRes.json();
      const audioBuffer = await base64ToAudioBuffer(audioBase64, "audio/mpeg");

      updateTrack(newTrackId, {
        audioBuffer,
        isLoading: false,
      });
    } catch (err) {
      console.error("Text command error:", err);
      updateTrack(newTrackId, {
        isLoading: false,
        name: `${description} (failed)`,
      });
    }

    setIsProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-center">
      <div className="flex-1 relative">
        <div className="absolute left-2.5 top-1/2 -translate-y-1/2">
          <span className="text-[9px] text-[#505058] uppercase tracking-wider">Add</span>
        </div>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="trap drums, piano chords, bass line..."
          className="w-full h-10 bg-[#0D0D0F] border border-[#2A2A2E] rounded pl-11 pr-3 text-[11px] text-[#E0E0E4] placeholder:text-[#3A3A42] outline-none focus:border-[#00D4FF]/40 transition-colors font-[family-name:var(--font-mono)]"
          style={{ boxShadow: "inset 0 1px 3px rgba(0,0,0,0.3)" }}
          disabled={isProcessing}
        />
      </div>
      <motion.button
        type="submit"
        disabled={!input.trim() || isProcessing}
        whileTap={{ scale: 0.9 }}
        whileHover={{ scale: 1.05 }}
        className="w-10 h-10 rounded flex items-center justify-center bg-[#232328] border border-[#2A2A2E] text-[#00FF87] hover:bg-[#2C2C33] hover:border-[#00FF87]/30 disabled:opacity-30 disabled:hover:bg-[#232328] transition-all"
      >
        {isProcessing ? (
          <Loader2 className="w-4 h-4 animate-spin text-[#808088]" />
        ) : (
          <Send className="w-4 h-4" />
        )}
      </motion.button>
    </form>
  );
}
