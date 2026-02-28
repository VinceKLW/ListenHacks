"use client";

import { useState, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Mic, Loader2 } from "lucide-react";
import { useTracksStore } from "@/store/tracks";
import { blobToBase64, base64ToAudioBuffer } from "@/lib/audio-utils";
import {
  generateMidiTrack,
  getMidiInstrumentColor,
  detectInstrumentFromDescription,
} from "@/lib/generate-midi-track";
import { VoiceCommand } from "@/types/music";
import { v4 as uuidv4 } from "uuid";

export default function VoiceCommandBar() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const { step, addTrack, updateTrack, analysis, timeSelections } = useTracksStore();

  if (step !== "studio") return null;

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await processCommand(blob);
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setStatusText("Listening...");
    } catch (err) {
      console.error("Mic access error:", err);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const processCommand = async (blob: Blob) => {
    setIsProcessing(true);
    setStatusText("Processing...");

    try {
      const audioBase64 = await blobToBase64(blob);
      const cmdRes = await fetch("/api/voice-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64, mimeType: "audio/webm" }),
      });

      if (!cmdRes.ok) throw new Error("Command parse failed");
      const command: VoiceCommand = await cmdRes.json();

      setStatusText(command.description);

      if (command.action === "add_beat") {
        // --- Percussion → ElevenLabs ---
        if (timeSelections.length > 0) {
          // One beat per selection, generated sequentially
          for (const sel of timeSelections) {
            const newTrackId = uuidv4();
            addTrack({
              id: newTrackId,
              name: command.description,
              type: "beat",
              audioUrl: null,
              audioBuffer: null,
              volume: 0.7,
              muted: false,
              solo: false,
              color: "#ea580c",
              isLoading: true,
              startOffset: sel.start,
            });
            setStatusText(`Generating: ${command.description}`);
            const beatRes = await fetch("/api/generate-beat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ description: command.description, durationSeconds: sel.end - sel.start }),
            });
            if (!beatRes.ok) throw new Error("Beat generation failed");
            const { audioBase64: beatBase64 } = await beatRes.json();
            const audioBuffer = await base64ToAudioBuffer(beatBase64, "audio/mpeg");
            updateTrack(newTrackId, { audioBuffer, isLoading: false });
          }
          setStatusText(`Added ${timeSelections.length} beat${timeSelections.length > 1 ? "s" : ""}: ${command.description}`);
        } else {
          // No selection — single 8s beat
          const newTrackId = uuidv4();
          addTrack({
            id: newTrackId,
            name: command.description,
            type: "beat",
            audioUrl: null,
            audioBuffer: null,
            volume: 0.7,
            muted: false,
            solo: false,
            color: "#ea580c",
            isLoading: true,
          });
          setStatusText(`Generating: ${command.description}`);
          const beatRes = await fetch("/api/generate-beat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ description: command.description, durationSeconds: 8 }),
          });
          if (!beatRes.ok) throw new Error("Beat generation failed");
          const { audioBase64: beatBase64 } = await beatRes.json();
          const audioBuffer = await base64ToAudioBuffer(beatBase64, "audio/mpeg");
          updateTrack(newTrackId, { audioBuffer, isLoading: false });
          setStatusText(`Added: ${command.description}`);
        }

      } else if (command.action === "add_instrument") {
        // --- Melodic → MIDI pipeline ---
        const instrument = command.instrument
          ? (command.instrument as Parameters<typeof generateMidiTrack>[1])
          : detectInstrumentFromDescription(command.description);

        if (timeSelections.length > 0) {
          // One instrument track per selection, generated sequentially
          for (const sel of timeSelections) {
            const newTrackId = uuidv4();
            addTrack({
              id: newTrackId,
              name: command.description,
              type: "midi",
              audioUrl: null,
              audioBuffer: null,
              volume: 0.7,
              muted: false,
              solo: false,
              color: getMidiInstrumentColor(instrument),
              isLoading: true,
              startOffset: sel.start,
            });
            setStatusText(`Generating ${instrument}: ${command.description}...`);
            const durationSec = sel.end - sel.start;
            if (analysis) {
              const { audioBuffer } = await generateMidiTrack(analysis, instrument, durationSec);
              updateTrack(newTrackId, { audioBuffer, isLoading: false });
            } else {
              const beatRes = await fetch("/api/generate-beat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ description: command.description, durationSeconds: durationSec }),
              });
              if (!beatRes.ok) throw new Error("Generation failed");
              const { audioBase64: fallbackBase64 } = await beatRes.json();
              const audioBuffer = await base64ToAudioBuffer(fallbackBase64, "audio/mpeg");
              updateTrack(newTrackId, { audioBuffer, isLoading: false });
            }
          }
          setStatusText(`Added ${timeSelections.length} ${instrument}${timeSelections.length > 1 ? "s" : ""}: ${command.description}`);
        } else {
          // No selection — single instrument for full hum duration
          const instrDuration = analysis?.durationSeconds ?? 16;
          const newTrackId = uuidv4();
          addTrack({
            id: newTrackId,
            name: command.description,
            type: "midi",
            audioUrl: null,
            audioBuffer: null,
            volume: 0.7,
            muted: false,
            solo: false,
            color: getMidiInstrumentColor(instrument),
            isLoading: true,
          });
          setStatusText(`Generating ${instrument}: ${command.description}...`);
          if (analysis) {
            const { audioBuffer } = await generateMidiTrack(analysis, instrument, instrDuration);
            updateTrack(newTrackId, { audioBuffer, isLoading: false });
            setStatusText(`Added: ${command.description}`);
          } else {
            const beatRes = await fetch("/api/generate-beat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ description: command.description, durationSeconds: instrDuration }),
            });
            if (!beatRes.ok) throw new Error("Generation failed");
            const { audioBase64: fallbackBase64 } = await beatRes.json();
            const audioBuffer = await base64ToAudioBuffer(fallbackBase64, "audio/mpeg");
            updateTrack(newTrackId, { audioBuffer, isLoading: false });
            setStatusText(`Added: ${command.description}`);
          }
        }

      } else if (command.action === "change_mood") {
        setStatusText(`Mood noted: ${command.description}`);
      } else if (command.action === "export") {
        setStatusText("Use export in transport bar");
      }
    } catch (err) {
      console.error("Voice command error:", err);
      setStatusText("Command failed");
    }

    setIsProcessing(false);
    setTimeout(() => setStatusText(""), 4000);
  };

  return (
    <div className="flex items-center gap-2">
      {/* Voice Command Button */}
      <motion.button
        disabled={isProcessing}
        onClick={isRecording ? stopRecording : startRecording}
        whileTap={{ scale: 0.9 }}
        whileHover={{ scale: 1.05 }}
        className={`w-10 h-10 rounded flex items-center justify-center transition-all ${
          isRecording
            ? "bg-[#FF3B30]/20 border border-[#FF3B30]/40 recording-pulse"
            : isProcessing
              ? "bg-[#232328] border border-[#2A2A2E] opacity-50"
              : "bg-[#232328] border border-[#2A2A2E] hover:bg-[#2C2C33] hover:border-[#A855F7]/30"
        }`}
      >
        {isProcessing ? (
          <Loader2 className="w-4 h-4 text-[#808088] animate-spin" />
        ) : (
          <Mic className={`w-4 h-4 ${isRecording ? "text-[#FF3B30]" : "text-[#A855F7]"}`} />
        )}
      </motion.button>

      <AnimatePresence>
        {statusText && (
          <motion.div
            initial={{ opacity: 0, x: -8, width: 0 }}
            animate={{ opacity: 1, x: 0, width: "auto" }}
            exit={{ opacity: 0, x: -8, width: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="lcd-display px-2 py-1 overflow-hidden"
          >
            <span className="text-[9px] led-cyan whitespace-nowrap">{statusText}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
