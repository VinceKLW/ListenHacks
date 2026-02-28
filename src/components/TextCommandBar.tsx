"use client";

import { useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
      color: isBeat ? "#ea580c" : "#059669",
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
    <div className="w-full max-w-4xl mx-auto mt-3">
      <form
        onSubmit={handleSubmit}
        className="flex gap-2 p-3 rounded-lg bg-gray-900 border border-gray-800"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='Or type: "trap drums", "piano chords", "bass line"...'
          className="flex-1 bg-transparent text-white text-sm placeholder:text-gray-600 outline-none"
          disabled={isProcessing}
        />
        <Button
          type="submit"
          size="sm"
          disabled={!input.trim() || isProcessing}
          className="bg-violet-600 hover:bg-violet-700"
        >
          {isProcessing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </form>
    </div>
  );
}
