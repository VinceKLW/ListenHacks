"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Mic, Square, X, Check, AlertTriangle } from "lucide-react";
import { useTracksStore } from "@/store/tracks";
import { blobToBase64, blobToAudioBuffer, getAudioContext } from "@/lib/audio-utils";
import {
  generateMidiTrack,
  getMidiInstrumentColor,
  getDefaultLayers,
} from "@/lib/generate-midi-track";
import { mixer } from "@/lib/mixer";
import { InstrumentType } from "@/types/midi";
import { v4 as uuidv4 } from "uuid";

type ModalPhase = "confirm" | "idle" | "recording" | "analyzing" | "generating" | "done";

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

interface HumAddModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const panelVariants = {
  initial: { opacity: 0, scale: 0.95, y: 12 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: -12 },
};

export default function HumAddModal({ isOpen, onClose }: HumAddModalProps) {
  const [phase, setPhase] = useState<ModalPhase>("idle");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [generatingLayers, setGeneratingLayers] = useState<string[]>([]);
  const [generationProgress, setGenerationProgress] = useState<
    Record<string, "pending" | "done" | "failed">
  >({});

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const { tracks, addTrack, updateTrack, setAnalysis, clearTracks } = useTracksStore();

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

  // Set initial phase when modal opens
  useEffect(() => {
    if (isOpen) {
      setPhase(tracks.length > 0 ? "confirm" : "idle");
      setIsRecording(false);
      setRecordingTime(0);
      setAudioLevel(0);
      setGeneratingLayers([]);
      setGenerationProgress({});
    }
  }, [isOpen]);

  const handleConfirmRegenerate = () => {
    mixer.stop();
    mixer.setPosition(0);
    clearTracks();
    setPhase("idle");
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

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
        await processHum(blob);
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setPhase("recording");
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    } catch (err) {
      console.error("Mic access denied:", err);
      alert("Please allow microphone access to use Hum Producer.");
    }
  }, [updateLevel]);

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

    setPhase("analyzing");
    try {
      const audioBase64 = await blobToBase64(blob);
      const analyzeRes = await fetch("/api/analyze-hum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64, mimeType: "audio/webm" }),
      });

      if (!analyzeRes.ok) throw new Error("Analysis failed");
      const analysis = await analyzeRes.json();
      analysis.durationSeconds = humBuffer.duration;
      setAnalysis(analysis);

      setPhase("generating");
      const defaultLayers = getDefaultLayers(analysis.genre);
      setGeneratingLayers(defaultLayers);
      setGenerationProgress(
        Object.fromEntries(defaultLayers.map((l) => [l, "pending"]))
      );

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

      await Promise.allSettled(
        layerTracks.map(async ({ id, instrument }) => {
          try {
            const { audioBuffer } = await generateMidiTrack(
              analysis,
              instrument as InstrumentType,
              analysis.durationSeconds ?? 16
            );
            updateTrack(id, { audioBuffer, isLoading: false });
            setGenerationProgress((prev) => ({ ...prev, [instrument]: "done" }));
          } catch (err) {
            console.error(`Failed to generate ${instrument}:`, err);
            updateTrack(id, {
              isLoading: false,
              name: `${instrument} (failed)`,
            });
            setGenerationProgress((prev) => ({ ...prev, [instrument]: "failed" }));
          }
        })
      );

      setPhase("done");
      setTimeout(onClose, 1500);
    } catch (err) {
      console.error("Hum processing error:", err);
      setPhase("done");
      setTimeout(onClose, 1500);
    }
  };

  const canClose = phase !== "analyzing" && phase !== "generating";

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={canClose ? onClose : undefined}
    >
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-[#0D0D0F]/80 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      />

      {/* Panel */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 16 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="daw-panel rounded-lg p-8 flex flex-col items-center gap-6 relative noise-overlay w-full max-w-sm mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Rack screws */}
        <div className="absolute top-3 left-3 rack-screw" />
        <div className="absolute top-3 right-3 rack-screw" />
        <div className="absolute bottom-3 left-3 rack-screw" />
        <div className="absolute bottom-3 right-3 rack-screw" />

        {/* Close button */}
        {canClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-10 w-5 h-5 flex items-center justify-center text-[#505058] hover:text-[#E0E0E4] transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Header */}
        <motion.div
          className="flex items-center gap-2"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <span className="text-[10px] uppercase tracking-[0.12em] text-[#808088] font-[family-name:var(--font-display)] font-semibold">
            Regenerate Hum
          </span>
        </motion.div>

        {/* Phase content */}
        <AnimatePresence mode="wait">

          {/* ── Confirm ── */}
          {phase === "confirm" && (
            <motion.div
              key="confirm-ui"
              variants={panelVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="flex flex-col items-center gap-5 w-full"
            >
              <div
                className="lcd-display px-5 py-4 flex flex-col items-center gap-3 w-full"
                style={{ borderColor: "rgba(255,184,0,0.2)" }}
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle
                    className="w-4 h-4 shrink-0"
                    style={{
                      color: "#FFB800",
                      filter: "drop-shadow(0 0 4px #FFB80080)",
                    }}
                  />
                  <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#FFB800" }}>
                    Destructive Action
                  </span>
                </div>
                <p className="text-[10px] text-[#808088] text-center leading-relaxed">
                  Regenerating will delete your current hum and all{" "}
                  <span className="text-[#E0E0E4]">{tracks.length}</span> generated{" "}
                  {tracks.length === 1 ? "track" : "tracks"}.
                </p>
              </div>

              <div className="flex gap-3 w-full">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={onClose}
                  className="flex-1 h-8 rounded text-[10px] uppercase tracking-wider font-semibold bg-[#232328] border border-[#2A2A2E] text-[#808088] hover:text-[#E0E0E4] hover:bg-[#2C2C33] transition-all"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleConfirmRegenerate}
                  className="flex-1 h-8 rounded text-[10px] uppercase tracking-wider font-semibold border transition-all"
                  style={{
                    backgroundColor: "rgba(255,59,48,0.1)",
                    borderColor: "rgba(255,59,48,0.3)",
                    color: "#FF3B30",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(255,59,48,0.2)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(255,59,48,0.1)";
                  }}
                >
                  Delete &amp; Regenerate
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ── Idle / Recording ── */}
          {(phase === "idle" || phase === "recording") && (
            <motion.div
              key="record-ui"
              variants={panelVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="flex flex-col items-center gap-6 w-full"
            >
              <div className="lcd-display px-6 py-3 text-center w-full">
                <p className="text-[11px] text-[#808088] uppercase tracking-wider mb-1">
                  Hum your melody
                </p>
                <p className="text-[10px] text-[#505058]">
                  Record 5–15 seconds. AI will analyze and produce a full track.
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="h-20">
                  <LevelMeter level={audioLevel} />
                </div>

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

                <div className="h-20">
                  <LevelMeter level={audioLevel * 0.85} />
                </div>
              </div>

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
                        {Math.floor(recordingTime / 60)}:
                        {String(recordingTime % 60).padStart(2, "0")}
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

          {/* ── Analyzing ── */}
          {phase === "analyzing" && (
            <motion.div
              key="analyzing-ui"
              variants={panelVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="flex flex-col items-center gap-5"
            >
              <span className="text-[10px] uppercase tracking-[0.12em] text-[#808088] font-[family-name:var(--font-display)] font-semibold">
                Signal Analysis
              </span>
              <div className="lcd-display px-8 py-4 flex flex-col items-center gap-3">
                <div className="flex gap-1">
                  {[18, 28, 14, 32, 22, 36, 16, 30, 20, 34, 12, 26, 24, 35, 15, 29, 21, 33, 17, 31, 19, 27, 23, 25].map(
                    (h, i) => (
                      <div
                        key={i}
                        className="w-1 rounded-full bg-[#00D4FF] animate-signal"
                        style={{
                          height: `${h}px`,
                          animationDelay: `${i * 0.08}s`,
                          opacity: 0.4 + (i % 3) * 0.2,
                        }}
                      />
                    )
                  )}
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

          {/* ── Generating ── */}
          {phase === "generating" && (
            <motion.div
              key="generating-ui"
              variants={panelVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="flex flex-col items-center gap-5"
            >
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
                  <div className="flex gap-2 flex-wrap justify-center">
                    {generatingLayers.map((layer) => {
                      const status = generationProgress[layer] ?? "pending";
                      return (
                        <div
                          key={layer}
                          className={`lcd-display px-2 py-0.5 flex items-center gap-1.5 transition-all ${
                            status === "done"
                              ? "border border-[#00FF87]/20"
                              : status === "failed"
                              ? "border border-[#FF3B30]/20"
                              : ""
                          }`}
                        >
                          {status === "done" && (
                            <div className="led-dot led-dot-green w-1.5 h-1.5" />
                          )}
                          {status === "failed" && (
                            <div className="led-dot led-dot-red w-1.5 h-1.5" />
                          )}
                          {status === "pending" && (
                            <div className="w-1.5 h-1.5 rounded-full bg-[#3A3A42]" />
                          )}
                          <span
                            className={`text-[9px] uppercase tracking-wider ${
                              status === "done"
                                ? "led-green"
                                : status === "failed"
                                ? "text-[#FF3B30]/60"
                                : "text-[#505058]"
                            }`}
                          >
                            {layer}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <p className="text-[10px] text-[#505058]">
                Rendering instrument layers. This may take a moment.
              </p>
            </motion.div>
          )}

          {/* ── Done ── */}
          {phase === "done" && (
            <motion.div
              key="done-ui"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="flex flex-col items-center gap-3 py-4"
            >
              <div className="w-12 h-12 rounded-full bg-[#00FF87]/10 border border-[#00FF87]/30 flex items-center justify-center">
                <Check
                  className="w-6 h-6 text-[#00FF87]"
                  style={{ filter: "drop-shadow(0 0 6px #00FF87)" }}
                />
              </div>
              <span className="text-[11px] led-green">TRACKS ADDED</span>
              <span className="text-[9px] text-[#505058] uppercase tracking-wider">
                Closing...
              </span>
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>
    </div>
  );
}
