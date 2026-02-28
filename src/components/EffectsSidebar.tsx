"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { useTracksStore } from "@/store/tracks";
import { Slider } from "@/components/ui/slider";
import {
  DEFAULT_EFFECTS,
  type TrackEffects,
  type ReverbEffect,
  type DelayEffect,
  type FilterEffect,
  type DistortionEffect,
  type CompressorEffect,
} from "@/types/effects";

function EffectToggle({
  label,
  enabled,
  onChange,
}: {
  label: string;
  enabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[9px] uppercase tracking-wider text-[#808088]">
        {label}
      </span>
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => onChange(!enabled)}
        className={`w-8 h-4 rounded-full transition-colors ${
          enabled
            ? "bg-[#00FF87] shadow-[0_0_6px_rgba(0,255,135,0.4)]"
            : "bg-[#232328] border border-[#2A2A2E]"
        }`}
      >
        <motion.div
          className="w-3 h-3 rounded-full bg-white shadow-sm"
          animate={{ x: enabled ? 14 : 2 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      </motion.button>
    </div>
  );
}

function Knob({
  label,
  value,
  min,
  max,
  onChange,
  format = (v) => String(v),
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center">
        <span className="text-[8px] uppercase tracking-wider text-[#505058]">
          {label}
        </span>
        <span className="text-[9px] font-[tabular-nums] text-[#00FF87]">
          {format(value)}
        </span>
      </div>
      <Slider
        value={[pct]}
        min={0}
        max={100}
        step={1}
        onValueChange={([v]) => onChange(min + (v / 100) * (max - min))}
        className="w-full"
      />
    </div>
  );
}

export default function EffectsSidebar() {
  const {
    tracks,
    selectedTrackId,
    setSelectedTrackId,
    updateTrack,
  } = useTracksStore();

  const track = tracks.find((t) => t.id === selectedTrackId);

  // Clear selection if track was deleted
  useEffect(() => {
    if (selectedTrackId && !track) {
      setSelectedTrackId(null);
    }
  }, [selectedTrackId, track, setSelectedTrackId]);

  const effects: TrackEffects = {
    ...DEFAULT_EFFECTS,
    ...(track?.effects ?? {}),
  };

  const updateEffect = <K extends keyof TrackEffects>(
    key: K,
    updater: (prev: NonNullable<TrackEffects[K]>) => NonNullable<TrackEffects[K]>
  ) => {
    if (!track) return;
    const prev = { ...DEFAULT_EFFECTS, ...track.effects };
    const next = {
      ...prev,
      [key]: updater((prev[key] ?? DEFAULT_EFFECTS[key]) as NonNullable<TrackEffects[K]>),
    };
    updateTrack(track.id, { effects: next });
  };

  if (!selectedTrackId || !track) return null;

  return (
    <AnimatePresence>
      {selectedTrackId && (
      <motion.aside
        key={selectedTrackId}
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: 280, opacity: 1 }}
        exit={{ width: 0, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="shrink-0 border-l border-[#2A2A2E] bg-[#151518] overflow-hidden flex flex-col"
      >
        <div className="w-[280px] h-full flex flex-col overflow-auto">
          {/* Header */}
          <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-[#2A2A2E]">
            <span className="text-[10px] uppercase tracking-[0.12em] text-[#808088] font-semibold">
              Effects
            </span>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setSelectedTrackId(null)}
              className="w-6 h-6 flex items-center justify-center rounded bg-[#232328] border border-[#2A2A2E] text-[#505058] hover:text-[#E0E0E4] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </motion.button>
          </div>

          <div className="px-3 py-2 border-b border-[#2A2A2E]">
            <p className="text-[11px] font-medium text-[#E0E0E4] truncate">
              {track.name}
            </p>
            <p className="text-[9px] text-[#505058] uppercase tracking-wider">
              {track.type}
            </p>
          </div>

          <div className="flex-1 overflow-auto p-3 space-y-4">
            {/* Reverb */}
            <div className="daw-panel rounded-lg p-3 space-y-2">
              <EffectToggle
                label="Reverb"
                enabled={effects.reverb!.enabled}
                onChange={(v) =>
                  updateEffect("reverb", (r) => ({ ...r, enabled: v }))
                }
              />
              <AnimatePresence>
              {effects.reverb!.enabled && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2 pt-2 border-t border-[#2A2A2E]"
                >
                  <Knob
                    label="Decay"
                    value={(effects.reverb as ReverbEffect).decay}
                    min={0.5}
                    max={10}
                    onChange={(v) =>
                      updateEffect("reverb", (r) => ({ ...r, decay: v }))
                    }
                    format={(v) => `${v.toFixed(1)}s`}
                  />
                  <Knob
                    label="Wet"
                    value={(effects.reverb as ReverbEffect).wet * 100}
                    min={0}
                    max={100}
                    onChange={(v) =>
                      updateEffect("reverb", (r) => ({ ...r, wet: v / 100 }))
                    }
                    format={(v) => `${Math.round(v)}%`}
                  />
                </motion.div>
              )}
              </AnimatePresence>
            </div>

            {/* Delay */}
            <div className="daw-panel rounded-lg p-3 space-y-2">
              <EffectToggle
                label="Delay"
                enabled={effects.delay!.enabled}
                onChange={(v) =>
                  updateEffect("delay", (d) => ({ ...d, enabled: v }))
                }
              />
              <AnimatePresence>
              {effects.delay!.enabled && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2 pt-2 border-t border-[#2A2A2E]"
                >
                  <Knob
                    label="Time"
                    value={(effects.delay as DelayEffect).time * 1000}
                    min={100}
                    max={2000}
                    onChange={(v) =>
                      updateEffect("delay", (d) => ({ ...d, time: v / 1000 }))
                    }
                    format={(v) => `${v}ms`}
                  />
                  <Knob
                    label="Feedback"
                    value={(effects.delay as DelayEffect).feedback * 100}
                    min={0}
                    max={95}
                    onChange={(v) =>
                      updateEffect("delay", (d) => ({
                        ...d,
                        feedback: v / 100,
                      }))
                    }
                    format={(v) => `${Math.round(v)}%`}
                  />
                  <Knob
                    label="Wet"
                    value={(effects.delay as DelayEffect).wet * 100}
                    min={0}
                    max={100}
                    onChange={(v) =>
                      updateEffect("delay", (d) => ({ ...d, wet: v / 100 }))
                    }
                    format={(v) => `${Math.round(v)}%`}
                  />
                </motion.div>
              )}
              </AnimatePresence>
            </div>

            {/* Filter */}
            <div className="daw-panel rounded-lg p-3 space-y-2">
              <EffectToggle
                label="Filter"
                enabled={effects.filter!.enabled}
                onChange={(v) =>
                  updateEffect("filter", (f) => ({ ...f, enabled: v }))
                }
              />
              <AnimatePresence>
              {effects.filter!.enabled && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2 pt-2 border-t border-[#2A2A2E]"
                >
                  <div className="flex gap-2">
                    {(["lowpass", "highpass", "bandpass"] as const).map(
                      (type) => (
                        <button
                          key={type}
                          onClick={() =>
                            updateEffect("filter", (f) => ({
                              ...f,
                              type,
                            }))
                          }
                          className={`flex-1 py-1.5 rounded text-[8px] uppercase tracking-wider transition-all ${
                            (effects.filter as FilterEffect).type === type
                              ? "bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]/40"
                              : "bg-[#232328] text-[#505058] border border-[#2A2A2E] hover:text-[#808088]"
                          }`}
                        >
                          {type.slice(0, 4)}
                        </button>
                      )
                    )}
                  </div>
                  <Knob
                    label="Freq"
                    value={(effects.filter as FilterEffect).frequency}
                    min={20}
                    max={20000}
                    onChange={(v) =>
                      updateEffect("filter", (f) => ({ ...f, frequency: v }))
                    }
                    format={(v) =>
                      v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`
                    }
                  />
                  <Knob
                    label="Q"
                    value={(effects.filter as FilterEffect).Q}
                    min={0.1}
                    max={10}
                    onChange={(v) =>
                      updateEffect("filter", (f) => ({ ...f, Q: v }))
                    }
                    format={(v) => v.toFixed(1)}
                  />
                </motion.div>
              )}
              </AnimatePresence>
            </div>

            {/* Distortion */}
            <div className="daw-panel rounded-lg p-3 space-y-2">
              <EffectToggle
                label="Distortion"
                enabled={effects.distortion!.enabled}
                onChange={(v) =>
                  updateEffect("distortion", (d) => ({ ...d, enabled: v }))
                }
              />
              <AnimatePresence>
              {effects.distortion!.enabled && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="pt-2 border-t border-[#2A2A2E]"
                >
                  <Knob
                    label="Amount"
                    value={(effects.distortion as DistortionEffect).amount * 100}
                    min={0}
                    max={100}
                    onChange={(v) =>
                      updateEffect("distortion", (d) => ({
                        ...d,
                        amount: v / 100,
                      }))
                    }
                    format={(v) => `${Math.round(v)}%`}
                  />
                </motion.div>
              )}
              </AnimatePresence>
            </div>

            {/* Compressor */}
            <div className="daw-panel rounded-lg p-3 space-y-2">
              <EffectToggle
                label="Compressor"
                enabled={effects.compressor!.enabled}
                onChange={(v) =>
                  updateEffect("compressor", (c) => ({ ...c, enabled: v }))
                }
              />
              <AnimatePresence>
              {effects.compressor!.enabled && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2 pt-2 border-t border-[#2A2A2E]"
                >
                  <Knob
                    label="Threshold"
                    value={(effects.compressor as CompressorEffect).threshold}
                    min={-60}
                    max={0}
                    onChange={(v) =>
                      updateEffect("compressor", (c) => ({
                        ...c,
                        threshold: v,
                      }))
                    }
                    format={(v) => `${v} dB`}
                  />
                  <Knob
                    label="Ratio"
                    value={(effects.compressor as CompressorEffect).ratio}
                    min={1}
                    max={20}
                    onChange={(v) =>
                      updateEffect("compressor", (c) => ({ ...c, ratio: v }))
                    }
                    format={(v) => `${v}:1`}
                  />
                  <Knob
                    label="Knee"
                    value={(effects.compressor as CompressorEffect).knee}
                    min={0}
                    max={40}
                    onChange={(v) =>
                      updateEffect("compressor", (c) => ({ ...c, knee: v }))
                    }
                    format={(v) => `${v} dB`}
                  />
                </motion.div>
              )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.aside>
      )}
    </AnimatePresence>
  );
}
