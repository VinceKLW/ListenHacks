"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Mic, Square } from "lucide-react";
import { useTracksStore } from "@/store/tracks";
import { blobToBase64, blobToAudioBuffer, getAudioContext } from "@/lib/audio-utils";
import {
  generateMidiTrack,
  getMidiInstrumentColor,
  getDefaultLayers,
} from "@/lib/generate-midi-track";
import { InstrumentType } from "@/types/midi";
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
  const [generatingLayers, setGeneratingLayers] = useState<string[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const { step, setStep, setHumBlob, setAnalysis, addTrack, updateTrack } =
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

    setStep("analyzing");
    try {
      const audioBase64 = await blobToBase64(blob);
      const analyzeRes = await fetch("/api/analyze-hum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64, mimeType: "audio/webm" }),
      });

      if (!analyzeRes.ok) throw new Error("Analysis failed");
      const analysis = await analyzeRes.json();
      const targetDurationSeconds = Math.max(humBuffer.duration, 32);
      analysis.durationSeconds = targetDurationSeconds;
      setAnalysis(analysis);

      // Generate individual layers via MIDI (avoid limiting to hum length)
      setStep("generating");
      let defaultLayers = getDefaultLayers(analysis.genre);
      // Always prepend "lead" when we have a good melody transcription — this
      // plays the user's exact hum back as a synth melody and anchors all other layers.
      if (
        analysis.melody &&
        analysis.melody.length >= 4 &&
        !defaultLayers.includes("lead" as InstrumentType)
      ) {
        defaultLayers = ["lead" as InstrumentType, ...defaultLayers];
      }
      setGeneratingLayers(defaultLayers);

      // Create placeholder tracks for all layers
      const layerTracks = defaultLayers.map((layer) => {
        const id = uuidv4();
        addTrack({
          id,
          name: `${layer.charAt(0).toUpperCase() + layer.slice(1)} (${analysis.key})`,
          type: "midi",
          audioUrl: null,
          audioBuffer: null,
          volume: layer === "bass" ? 0.65 : layer === "pad" ? 0.5 : 0.7,
          muted: false,
          solo: false,
          color: getMidiInstrumentColor(layer),
          isLoading: true,
        });
        return { id, instrument: layer };
      });

      // Generate all layers in parallel
      await Promise.allSettled(
        layerTracks.map(async ({ id, instrument }) => {
          try {
            const { audioBuffer } = await generateMidiTrack(
              analysis,
              instrument as InstrumentType,
              analysis.durationSeconds ?? 32
            );
            updateTrack(id, { audioBuffer, isLoading: false });
          } catch (err) {
            console.error(`Failed to generate ${instrument}:`, err);
            updateTrack(id, {
              isLoading: false,
              name: `${instrument} (failed)`,
            });
          }
        })
      );

      setStep("studio");
    } catch (err) {
      console.error("Analysis error:", err);
      setStep("studio");
    }
  };

  if (step !== "record" && step !== "analyzing" && step !== "generating") {
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

            {/* TODO: remove this button before demo/production */}
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              onClick={() => setStep("studio")}
              className="text-[9px] text-[#3A3A42] hover:text-[#505058] underline underline-offset-2 transition-colors"
            >
              skip (remove later)
            </motion.button>
          </motion.div>
        )}

      {step === "analyzing" && (
        <motion.div
          key="analyzing"
          variants={panelVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="daw-panel rounded-lg p-8 flex flex-col items-center gap-5 relative noise-overlay"
        >
          <div className="absolute top-3 left-3 rack-screw" />
          <div className="absolute top-3 right-3 rack-screw" />
          <div className="absolute bottom-3 left-3 rack-screw" />
          <div className="absolute bottom-3 right-3 rack-screw" />

          <span className="text-[10px] uppercase tracking-[0.12em] text-[#808088] font-[family-name:var(--font-display)] font-semibold">
            Signal Analysis
          </span>

          <div className="lcd-display px-8 py-4 flex flex-col items-center gap-3">
            <div className="flex gap-1">
              {[18, 28, 14, 32, 22, 36, 16, 30, 20, 34, 12, 26, 24, 35, 15, 29, 21, 33, 17, 31, 19, 27, 23, 25].map((h, i) => (
                <div
                  key={i}
                  className="w-1 rounded-full bg-[#00D4FF] animate-signal"
                  style={{
                    height: `${h}px`,
                    animationDelay: `${i * 0.08}s`,
                    opacity: 0.4 + (i % 3) * 0.2,
                  }}
                />
              ))}
            </div>
            <span className="text-[11px] led-cyan animate-led-pulse">
              ANALYZING SIGNAL...
            </span>
          </div>

          <p className="text-[10px] text-[#505058]">
            Detecting key, tempo, mood, and genre
          </p>
        </motion.div>
      )}

      {step === "generating" && (
        <motion.div
          key="generating"
          variants={panelVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="daw-panel rounded-lg p-8 flex flex-col items-center gap-5 relative noise-overlay"
        >
          <div className="absolute top-3 left-3 rack-screw" />
          <div className="absolute top-3 right-3 rack-screw" />
          <div className="absolute bottom-3 left-3 rack-screw" />
          <div className="absolute bottom-3 right-3 rack-screw" />

          <span className="text-[10px] uppercase tracking-[0.12em] text-[#808088] font-[family-name:var(--font-display)] font-semibold">
            Track Generator
          </span>

          <div className="lcd-display px-8 py-4 flex flex-col items-center gap-3">
            <div className="w-48 h-2 bg-[#0D0D0F] rounded overflow-hidden">
              <div
                className="h-full rounded"
                style={{
                  background: "linear-gradient(90deg, #00FF87, #00D4FF)",
                  animation: "waveform-scan 2s ease-in-out infinite alternate",
                  width: "60%",
                }}
              />
            </div>
            <span className="text-[11px] led-green animate-led-pulse">
              GENERATING LAYERS...
            </span>
            {generatingLayers.length > 0 && (
              <span className="text-[10px] text-[#505058] uppercase tracking-wider">
                {generatingLayers.join(" · ")}
              </span>
            )}
          </div>

          <p className="text-[10px] text-[#505058]">
            Rendering instrument layers. This may take a moment.
          </p>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
