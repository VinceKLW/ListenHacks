"use client";

import { useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { useTracksStore } from "@/store/tracks";
import { base64ToAudioBuffer } from "@/lib/audio-utils";
import {
  generateMidiTrack,
  getMidiInstrumentColor,
  detectInstrumentFromDescription,
} from "@/lib/generate-midi-track";
import { v4 as uuidv4 } from "uuid";

const PERCUSSION_KEYWORDS = [
  "drum", "beat", "percussion", "hi-hat", "kick",
  "snare", "clap", "cymbal", "tom", "shaker", "tambourine",
];

export default function TextCommandBar() {
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const { step, addTrack, updateTrack, analysis } = useTracksStore();

  if (step !== "studio") return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    const description = input.trim();
    setInput("");
    setIsProcessing(true);

    const lowerDesc = description.toLowerCase();
    const isPercussion = PERCUSSION_KEYWORDS.some((kw) => lowerDesc.includes(kw));
    const newTrackId = uuidv4();

    if (isPercussion) {
      // --- ElevenLabs path for percussion ---
      addTrack({
        id: newTrackId,
        name: description,
        type: "beat",
        audioUrl: null,
        audioBuffer: null,
        volume: 0.7,
        muted: false,
        solo: false,
        color: "#ea580c",
        isLoading: true,
      });

      try {
        const beatRes = await fetch("/api/generate-beat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description, durationSeconds: 8 }),
        });
        if (!beatRes.ok) throw new Error("Generation failed");
        const { audioBase64 } = await beatRes.json();
        const audioBuffer = await base64ToAudioBuffer(audioBase64, "audio/mpeg");
        updateTrack(newTrackId, { audioBuffer, isLoading: false });
      } catch (err) {
        console.error("Beat generation error:", err);
        updateTrack(newTrackId, {
          isLoading: false,
          name: `${description} (failed)`,
        });
      }
    } else if (analysis) {
      // --- MIDI path for melodic instruments ---
      const instrument = detectInstrumentFromDescription(description);
      addTrack({
        id: newTrackId,
        name: description,
        type: "midi",
        audioUrl: null,
        audioBuffer: null,
        volume: 0.7,
        muted: false,
        solo: false,
        color: getMidiInstrumentColor(instrument),
        isLoading: true,
      });

      try {
        const { audioBuffer } = await generateMidiTrack(analysis, instrument, 16);
        updateTrack(newTrackId, { audioBuffer, isLoading: false });
      } catch (err) {
        console.error("MIDI generation error:", err);
        updateTrack(newTrackId, {
          isLoading: false,
          name: `${description} (failed)`,
        });
      }
    } else {
      // --- Fallback to ElevenLabs if no analysis yet ---
      addTrack({
        id: newTrackId,
        name: description,
        type: "instrument",
        audioUrl: null,
        audioBuffer: null,
        volume: 0.7,
        muted: false,
        solo: false,
        color: "#059669",
        isLoading: true,
      });

      try {
        const beatRes = await fetch("/api/generate-beat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description, durationSeconds: 8 }),
        });
        if (!beatRes.ok) throw new Error("Generation failed");
        const { audioBase64 } = await beatRes.json();
        const audioBuffer = await base64ToAudioBuffer(audioBase64, "audio/mpeg");
        updateTrack(newTrackId, { audioBuffer, isLoading: false });
      } catch (err) {
        console.error("Fallback generation error:", err);
        updateTrack(newTrackId, {
          isLoading: false,
          name: `${description} (failed)`,
        });
      }
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
      <button
        type="submit"
        disabled={!input.trim() || isProcessing}
        className="w-10 h-10 rounded flex items-center justify-center bg-[#232328] border border-[#2A2A2E] text-[#00FF87] hover:bg-[#2C2C33] hover:border-[#00FF87]/30 disabled:opacity-30 disabled:hover:bg-[#232328] transition-all"
      >
        {isProcessing ? (
          <Loader2 className="w-4 h-4 animate-spin text-[#808088]" />
        ) : (
          <Send className="w-4 h-4" />
        )}
      </button>
    </form>
  );
}
