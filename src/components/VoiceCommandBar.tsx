"use client";

import { useState, useRef } from "react";
import { Mic, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTracksStore } from "@/store/tracks";
import { blobToBase64, base64ToAudioBuffer } from "@/lib/audio-utils";
import { VoiceCommand } from "@/types/music";
import { v4 as uuidv4 } from "uuid";

export default function VoiceCommandBar() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const { step, addTrack, updateTrack, analysis } = useTracksStore();

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
      setStatusText("Listening... say what to add");
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
    setStatusText("Understanding your command...");

    try {
      const audioBase64 = await blobToBase64(blob);
      const cmdRes = await fetch("/api/voice-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64, mimeType: "audio/webm" }),
      });

      if (!cmdRes.ok) throw new Error("Command parse failed");
      const command: VoiceCommand = await cmdRes.json();

      setStatusText(`Got it: "${command.description}"`);

      if (
        command.action === "add_beat" ||
        command.action === "add_instrument"
      ) {
        const newTrackId = uuidv4();
        const trackType =
          command.action === "add_beat" ? "beat" : "instrument";
        const colors = {
          beat: "#ea580c",
          instrument: "#059669",
        };

        addTrack({
          id: newTrackId,
          name: command.description,
          type: trackType,
          audioUrl: null,
          audioBuffer: null,
          volume: 0.7,
          muted: false,
          solo: false,
          color: colors[trackType],
          isLoading: true,
        });

        setStatusText(`Generating: ${command.description}...`);

        const beatRes = await fetch("/api/generate-beat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: command.description,
            durationSeconds: 8,
          }),
        });

        if (!beatRes.ok) throw new Error("Beat generation failed");
        const { audioBase64: beatBase64 } = await beatRes.json();
        const audioBuffer = await base64ToAudioBuffer(beatBase64, "audio/mpeg");

        updateTrack(newTrackId, {
          audioBuffer,
          isLoading: false,
        });

        setStatusText(`Added: ${command.description}`);
      } else if (command.action === "change_mood" && analysis) {
        setStatusText(`Mood noted: ${command.description}`);
      } else if (command.action === "export") {
        setStatusText("Use the Export button to download your mix.");
      }
    } catch (err) {
      console.error("Voice command error:", err);
      setStatusText("Failed to process command. Try again.");
    }

    setIsProcessing(false);
    setTimeout(() => setStatusText(""), 4000);
  };

  return (
    <div className="w-full max-w-4xl mx-auto mt-6">
      <div className="flex flex-col items-center gap-3 p-6 rounded-xl bg-gray-900 border border-gray-800">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-400" />
          <h3 className="text-sm font-semibold text-gray-300">
            Add layers with your voice
          </h3>
        </div>

        <p className="text-xs text-gray-500 text-center">
          Say things like &quot;add trap drums&quot;, &quot;add a bass
          line&quot;, or &quot;add piano chords&quot;
        </p>

        <Button
          size="lg"
          disabled={isProcessing}
          className={`rounded-full w-16 h-16 ${
            isRecording
              ? "bg-red-600 hover:bg-red-700 animate-pulse"
              : isProcessing
                ? "bg-gray-700"
                : "bg-violet-600 hover:bg-violet-700"
          }`}
          onClick={isRecording ? stopRecording : startRecording}
        >
          {isProcessing ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <Mic className="w-6 h-6" />
          )}
        </Button>

        {statusText && (
          <p className="text-sm text-gray-400">
            {statusText}
          </p>
        )}
      </div>
    </div>
  );
}
