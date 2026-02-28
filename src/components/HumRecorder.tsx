"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Mic, Square } from "lucide-react";
import { useTracksStore } from "@/store/tracks";
import { blobToBase64, blobToAudioBuffer, getAudioContext } from "@/lib/audio-utils";
import { v4 as uuidv4 } from "uuid";

function LevelMeter({ level }: { level: number }) {
  const segments = 16;
  return (
    <div className="flex flex-col-reverse gap-[2px] w-3">
      {Array.from({ length: segments }, (_, i) => {
        const threshold = i / segments;
        const active = level > threshold;
        let color = "#00FF87";
        if (i >= segments - 2) color = "#FF3B30";
        else if (i >= segments - 5) color = "#FFB800";

        return (
          <motion.div
            key={i}
            className="h-[3px] rounded-[1px]"
            animate={{
              opacity: active ? 1 : 0.1,
              boxShadow: active ? `0 0 4px ${color}40` : "none",
            }}
            transition={{ duration: 0.05 }}
            style={{ backgroundColor: color }}
          />
        );
      })}
    </div>
  );
}

export default function HumRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const { step, setStep, setHumBlob, setAnalysis, addTrack } =
    useTracksStore();

  const updateLevel = useCallback(() => {
    if (!analyserRef.current) return;
    const data = new Uint8Array(analyserRef.current.fftSize);
    analyserRef.current.getByteTimeDomainData(data);
    let max = 0;
    for (let i = 0; i < data.length; i++) {
      const v = Math.abs(data[i] - 128) / 128;
      if (v > max) max = v;
    }
    setAudioLevel(max);
    animFrameRef.current = requestAnimationFrame(updateLevel);
  }, []);

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      // Set up analyser for level meter
      const audioCtx = getAudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      updateLevel();

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        setAudioLevel(0);
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
  }, [setHumBlob, updateLevel]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const processHum = async (blob: Blob) => {
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
      color: "#A855F7",
      isLoading: false,
    });

    // Go straight to studio
    setStep("studio");

    // Analyze in the background so analysis metadata appears in transport bar
    try {
      const audioBase64 = await blobToBase64(blob);
      const analyzeRes = await fetch("/api/analyze-hum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64, mimeType: "audio/webm" }),
      });

      if (analyzeRes.ok) {
        const analysis = await analyzeRes.json();
        setAnalysis(analysis);
      }
    } catch (err) {
      console.error("Analysis error:", err);
    }
  };

  if (step !== "record") {
    return null;
  }

  const panelVariants = {
    initial: { opacity: 0, scale: 0.95, y: 12 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.95, y: -12 },
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <AnimatePresence mode="wait">
        {step === "record" && (
          <motion.div
            key="record"
            variants={panelVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="daw-panel rounded-lg p-8 flex flex-col items-center gap-6 relative noise-overlay"
          >
            {/* Rack screws */}
            <div className="absolute top-3 left-3 rack-screw" />
            <div className="absolute top-3 right-3 rack-screw" />
            <div className="absolute bottom-3 left-3 rack-screw" />
            <div className="absolute bottom-3 right-3 rack-screw" />

            <motion.div
              className="flex items-center gap-2"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <span className="text-[10px] uppercase tracking-[0.12em] text-[#808088] font-[family-name:var(--font-display)] font-semibold">
                Input Channel
              </span>
            </motion.div>

            <motion.div
              className="lcd-display px-6 py-3 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
            >
              <p className="text-[11px] text-[#808088] uppercase tracking-wider mb-1">
                Hum your melody
              </p>
              <p className="text-[10px] text-[#505058]">
                Record 5-15 seconds. AI will analyze and produce a full track.
              </p>
            </motion.div>

            <div className="flex items-center gap-4">
              {/* Left meter */}
              <div className="h-20">
                <LevelMeter level={audioLevel} />
              </div>

              {/* Record Button */}
              <motion.button
                onClick={isRecording ? stopRecording : startRecording}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.92 }}
                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                  isRecording
                    ? "bg-[#FF3B30] shadow-[0_0_20px_rgba(255,59,48,0.4)] recording-pulse"
                    : "bg-[#232328] border border-[#2A2A2E] hover:bg-[#2C2C33] shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
                }`}
              >
                <AnimatePresence mode="wait">
                  {isRecording ? (
                    <motion.div
                      key="stop"
                      initial={{ scale: 0, rotate: -90 }}
                      animate={{ scale: 1, rotate: 0 }}
                      exit={{ scale: 0, rotate: 90 }}
                      transition={{ type: "spring", stiffness: 500, damping: 25 }}
                    >
                      <Square className="w-6 h-6 text-white" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="record"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 25 }}
                      className="w-10 h-10 rounded-full bg-[#FF3B30] flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                    >
                      <Mic className="w-5 h-5 text-white" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>

              {/* Right meter */}
              <div className="h-20">
                <LevelMeter level={audioLevel * 0.85} />
              </div>
            </div>

            {/* Timer / Status */}
            <div className="lcd-display px-4 py-1.5 min-w-[120px] text-center">
              <AnimatePresence mode="wait">
                {isRecording ? (
                  <motion.div
                    key="timer"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center justify-center gap-2"
                  >
                    <div className="led-dot led-dot-red animate-led-pulse" />
                    <span className="text-sm led-red font-[tabular-nums]">
                      {Math.floor(recordingTime / 60)}:{String(recordingTime % 60).padStart(2, "0")}
                    </span>
                  </motion.div>
                ) : (
                  <motion.span
                    key="ready"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-[10px] text-[#505058] uppercase tracking-wider"
                  >
                    Ready
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence>
              {!isRecording && (
                <motion.p
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="text-[10px] text-[#505058] tracking-wider uppercase"
                >
                  Tap to arm recording
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
