"use client";

import { useState, useRef, useCallback } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTracksStore } from "@/store/tracks";
import { blobToBase64, blobToAudioBuffer, getAudioContext } from "@/lib/audio-utils";
import { v4 as uuidv4 } from "uuid";

export default function HumRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const { step, setStep, setHumBlob, setAnalysis, addTrack, updateTrack } =
    useTracksStore();

  const startRecording = useCallback(async () => {
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
        setHumBlob(blob);
        await processHum(blob);
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    } catch (err) {
      console.error("Mic access denied:", err);
      alert("Please allow microphone access to use Hum Producer.");
    }
  }, [setHumBlob]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const processHum = async (blob: Blob) => {
    setStep("analyzing");

    // Add hum track immediately
    const humTrackId = uuidv4();
    const humBuffer = await blobToAudioBuffer(blob);
    addTrack({
      id: humTrackId,
      name: "Your Hum",
      type: "hum",
      audioUrl: URL.createObjectURL(blob),
      audioBuffer: humBuffer,
      volume: 0.8,
      muted: false,
      solo: false,
      color: "#7c3aed",
      isLoading: false,
    });

    // Analyze with Gemini
    try {
      const audioBase64 = await blobToBase64(blob);
      const analyzeRes = await fetch("/api/analyze-hum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64, mimeType: "audio/webm" }),
      });

      if (!analyzeRes.ok) throw new Error("Analysis failed");
      const analysis = await analyzeRes.json();
      setAnalysis(analysis);

      // Generate arrangement
      setStep("generating");
      const arrangementTrackId = uuidv4();
      addTrack({
        id: arrangementTrackId,
        name: "AI Arrangement",
        type: "arrangement",
        audioUrl: null,
        audioBuffer: null,
        volume: 0.7,
        muted: false,
        solo: false,
        color: "#2563eb",
        isLoading: true,
      });

      const genRes = await fetch("/api/generate-track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(analysis),
      });

      if (!genRes.ok) throw new Error("Generation failed");
      const { trackUrl } = await genRes.json();

      // Fetch audio through proxy to avoid CORS
      const proxiedUrl = `/api/proxy-audio?url=${encodeURIComponent(trackUrl)}`;
      const audioRes = await fetch(proxiedUrl);
      const arrayBuffer = await audioRes.arrayBuffer();
      const audioCtx = getAudioContext();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

      updateTrack(arrangementTrackId, {
        audioUrl: proxiedUrl,
        audioBuffer: audioBuffer,
        isLoading: false,
      });

      setStep("studio");
    } catch (err) {
      console.error("Processing error:", err);
      setStep("studio");
    }
  };

  if (step !== "record" && step !== "analyzing" && step !== "generating") {
    return null;
  }

  return (
    <div className="flex flex-col items-center gap-6 py-12">
      {step === "record" && (
        <>
          <h2 className="text-2xl font-bold text-white">Hum Your Melody</h2>
          <p className="text-gray-400 text-center max-w-md">
            Press record and hum a melody for 5-15 seconds.
            <br />
            We&apos;ll turn it into a full produced track.
          </p>

          <div className="relative">
            <Button
              size="lg"
              variant={isRecording ? "destructive" : "default"}
              className={`rounded-full w-24 h-24 ${
                isRecording
                  ? "bg-red-600 hover:bg-red-700 animate-pulse"
                  : "bg-violet-600 hover:bg-violet-700"
              }`}
              onClick={isRecording ? stopRecording : startRecording}
            >
              {isRecording ? (
                <Square className="w-8 h-8" />
              ) : (
                <Mic className="w-8 h-8" />
              )}
            </Button>
          </div>

          {isRecording && (
            <div className="text-red-400 font-mono text-lg">
              {Math.floor(recordingTime / 60)}:
              {String(recordingTime % 60).padStart(2, "0")}
            </div>
          )}

          {!isRecording && (
            <p className="text-gray-500 text-sm">Tap to start recording</p>
          )}
        </>
      )}

      {step === "analyzing" && (
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-violet-500 animate-spin" />
          <h2 className="text-xl font-semibold text-white">
            Analyzing your melody...
          </h2>
          <p className="text-gray-400">
            Detecting key, tempo, and mood with AI
          </p>
        </div>
      )}

      {step === "generating" && (
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
          <h2 className="text-xl font-semibold text-white">
            Generating arrangement...
          </h2>
          <p className="text-gray-400">
            Creating a full track based on your hum. This may take up to 60
            seconds.
          </p>
        </div>
      )}
    </div>
  );
}
