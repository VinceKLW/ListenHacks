import { MusicalAnalysis } from "@/types/music";
import {
  MidiTrackData,
  InstrumentType,
  MIDI_INSTRUMENT_COLORS,
} from "@/types/midi";
import { renderMidiToAudioBuffer, validateMidiNotes } from "./tone-renderer";

interface GenerateMidiTrackResult {
  audioBuffer: AudioBuffer;
  midiData: MidiTrackData;
}

export async function generateMidiTrack(
  analysis: MusicalAnalysis,
  instrument: InstrumentType,
  durationSeconds: number = 16
): Promise<GenerateMidiTrackResult> {
  // Step 1: Get MIDI data from Gemini
  const res = await fetch("/api/generate-midi", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      key: analysis.key,
      tempo: analysis.tempo,
      mood: analysis.mood,
      genre: analysis.genre,
      instrument,
      durationSeconds,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `MIDI generation failed: ${res.status}`);
  }

  const midiData: MidiTrackData = await res.json();

  // Step 2: Validate notes
  const invalidNotes = validateMidiNotes(midiData.notes);
  if (invalidNotes.length > 0) {
    console.warn("Filtering invalid notes from Gemini output:", invalidNotes);
    midiData.notes = midiData.notes.filter(
      (n) => !invalidNotes.includes(n.note)
    );

    if (midiData.notes.length === 0) {
      throw new Error("All notes from Gemini were invalid");
    }
  }

  // Step 3: Render to AudioBuffer via Tone.js
  const audioBuffer = await renderMidiToAudioBuffer(midiData);

  return { audioBuffer, midiData };
}

export function getMidiInstrumentColor(instrument: string): string {
  return (
    MIDI_INSTRUMENT_COLORS[instrument as InstrumentType] || "#3b82f6"
  );
}

export function getDefaultLayers(genre: string): InstrumentType[] {
  const genreLayers: Record<string, InstrumentType[]> = {
    pop: ["piano", "bass"],
    electronic: ["lead", "bass", "pad"],
    jazz: ["piano", "bass"],
    classical: ["piano", "pad"],
    hiphop: ["bass", "lead"],
    rock: ["lead", "bass"],
    rnb: ["piano", "bass", "pad"],
    lofi: ["piano", "bass", "pad"],
  };
  return genreLayers[genre] || ["piano", "bass"];
}

export function detectInstrumentFromDescription(desc: string): InstrumentType {
  const lower = desc.toLowerCase();
  if (
    lower.includes("piano") ||
    lower.includes("keys") ||
    lower.includes("chord")
  )
    return "piano";
  if (lower.includes("bass")) return "bass";
  if (
    lower.includes("pad") ||
    lower.includes("ambient") ||
    lower.includes("synth")
  )
    return "pad";
  if (lower.includes("lead") || lower.includes("solo")) return "lead";
  if (lower.includes("melody")) return "melody";
  return "lead";
}
