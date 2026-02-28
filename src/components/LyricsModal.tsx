"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Loader2, X } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { useTracksStore } from "@/store/tracks";
import { base64ToAudioBuffer, blobToBase64 } from "@/lib/audio-utils";
import { mixer } from "@/lib/mixer";

interface LyricsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const panelVariants = {
  initial: { opacity: 0, scale: 0.95, y: 12 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: -12 },
};

export default function LyricsModal({ isOpen, onClose }: LyricsModalProps) {
  const [lyrics, setLyrics] = useState("");
  const [stylePrompt, setStylePrompt] = useState("");
  const [durationSeconds, setDurationSeconds] = useState(20);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const { addTrack, updateTrack, tracks } = useTracksStore();

  useEffect(() => {
    if (isOpen) {
      setLyrics("");
      setStylePrompt("");
      setDurationSeconds(20);
      setIsGenerating(false);
      setErrorMessage("");
    }
  }, [isOpen]);

  const handleGenerateSinging = async () => {
    const trimmed = lyrics.trim();
    if (!trimmed || isGenerating) return;

    setIsGenerating(true);
    setErrorMessage("");
    const newTrackId = uuidv4();
    const firstLine = trimmed.split("\n")[0]?.slice(0, 28);
    const trackName = firstLine ? `Singing: ${firstLine}` : "Singing";

    addTrack({
      id: newTrackId,
      name: trackName,
      type: "vocal",
      audioUrl: null,
      audioBuffer: null,
      volume: 0.8,
      muted: false,
      solo: false,
      color: "#F97316",
      isLoading: true,
    });

    try {
      let targetDurationSeconds = durationSeconds;
      let mixAudioBase64: string | undefined;
      let mixMimeType: string | undefined;
      if (tracks.some((t) => t.audioBuffer)) {
        try {
          const mixBlob = await mixer.exportMix(tracks);
          mixAudioBase64 = await blobToBase64(mixBlob);
          mixMimeType = mixBlob.type || "audio/wav";
          const mixDurationSeconds = mixer.getDuration(tracks);
          if (Number.isFinite(mixDurationSeconds) && mixDurationSeconds > 0) {
            targetDurationSeconds = Math.max(
              targetDurationSeconds,
              Math.round(mixDurationSeconds)
            );
          }
        } catch (err) {
          console.warn("Failed to export mix for context:", err);
        }
      }

      const res = await fetch("/api/generate-singing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lyrics: trimmed,
          stylePrompt: stylePrompt.trim() || undefined,
          durationSeconds: targetDurationSeconds,
          mixAudioBase64,
          mixMimeType,
        }),
      });
      if (!res.ok) {
        let message = `Singing generation failed (${res.status})`;
        try {
          const data = await res.json();
          if (data?.error) message = data.error;
        } catch {
          try {
            const text = await res.text();
            if (text) message = text;
          } catch {
            // ignore
          }
        }
        throw new Error(message);
      }
      const { audioBase64, mimeType } = await res.json();
      const audioBuffer = await base64ToAudioBuffer(
        audioBase64,
        mimeType || "audio/mpeg"
      );
      updateTrack(newTrackId, { audioBuffer, isLoading: false });
      onClose();
    } catch (err) {
      console.error("Singing generation error:", err);
      setErrorMessage(err instanceof Error ? err.message : "Singing generation failed");
      updateTrack(newTrackId, {
        isLoading: false,
        name: `${trackName} (failed)`,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        className="absolute inset-0 bg-black/70"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      <AnimatePresence>
        <motion.div
          className="relative w-full max-w-lg bg-[#141418] border border-[#2A2A2E] rounded-xl shadow-xl"
          variants={panelVariants}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#2A2A2E]">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-[#808088]">Add Singing</p>
              <p className="text-[10px] text-[#505058]">
                ElevenLabs Music Compose - a cappella vocals only
              </p>
            </div>
            <motion.button
              onClick={onClose}
              whileTap={{ scale: 0.9 }}
              className="w-7 h-7 rounded flex items-center justify-center bg-[#232328] border border-[#2A2A2E]"
            >
              <X className="w-3.5 h-3.5 text-[#808088]" />
            </motion.button>
          </div>

          <div className="px-4 py-4 space-y-3">
            <div>
              <label className="text-[9px] uppercase tracking-wider text-[#505058]">
                Lyrics
              </label>
              <textarea
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                rows={6}
                placeholder="Write your lyrics here..."
                className="mt-2 w-full bg-[#0D0D0F] border border-[#2A2A2E] rounded px-3 py-2 text-[11px] text-[#E0E0E4] placeholder:text-[#3A3A42] outline-none focus:border-[#F97316]/40 transition-colors font-[family-name:var(--font-mono)]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] uppercase tracking-wider text-[#505058]">
                  Style prompt (optional)
                </label>
                <input
                  value={stylePrompt}
                  onChange={(e) => setStylePrompt(e.target.value)}
                  placeholder="dreamy pop ballad, soft synths, sparse drums"
                  className="mt-2 w-full h-9 bg-[#0D0D0F] border border-[#2A2A2E] rounded px-3 text-[11px] text-[#E0E0E4] placeholder:text-[#3A3A42] outline-none focus:border-[#F97316]/40 transition-colors font-[family-name:var(--font-mono)]"
                />
              </div>
              <div>
                <label className="text-[9px] uppercase tracking-wider text-[#505058]">
                  Duration (sec)
                </label>
                <input
                  type="number"
                  min={3}
                  max={300}
                  step={1}
                  value={durationSeconds}
                  onChange={(e) => setDurationSeconds(Number(e.target.value))}
                  className="mt-2 w-full h-9 bg-[#0D0D0F] border border-[#2A2A2E] rounded px-3 text-[11px] text-[#E0E0E4] outline-none focus:border-[#F97316]/40 transition-colors font-[family-name:var(--font-mono)]"
                />
              </div>
            </div>
            {errorMessage && (
              <div className="text-[10px] text-[#FF3B30]">
                {errorMessage}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[#2A2A2E]">
            <motion.button
              onClick={onClose}
              whileTap={{ scale: 0.95 }}
              className="h-9 px-3 rounded bg-[#232328] border border-[#2A2A2E] text-[11px] text-[#808088]"
            >
              Cancel
            </motion.button>
            <motion.button
              onClick={handleGenerateSinging}
              disabled={isGenerating || !lyrics.trim()}
              whileTap={{ scale: 0.95 }}
              className="h-9 px-4 rounded bg-[#F97316]/15 border border-[#F97316]/30 text-[#F97316] text-[11px] font-semibold disabled:opacity-40"
            >
              {isGenerating ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Generating
                </span>
              ) : (
                "Generate Singing"
              )}
            </motion.button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
