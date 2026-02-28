export interface MidiNote {
  note: string; // e.g. "C4", "Eb3", "F#5"
  time: number; // start time in seconds
  duration: number; // duration in seconds
  velocity: number; // 0.0 - 1.0
}

export interface MidiTrackData {
  instrument: string;
  bpm: number;
  key: string;
  timeSignature: string;
  durationSeconds: number;
  notes: MidiNote[];
}

export type InstrumentType = "piano" | "bass" | "pad" | "lead" | "melody";

export const MIDI_INSTRUMENT_COLORS: Record<InstrumentType, string> = {
  piano: "#3b82f6",
  bass: "#8b5cf6",
  pad: "#06b6d4",
  lead: "#f59e0b",
  melody: "#10b981",
};

export const MIDI_INSTRUMENT_ICONS: Record<InstrumentType, string> = {
  piano: "🎹",
  bass: "🎸",
  pad: "🎶",
  lead: "🎺",
  melody: "🎵",
};
