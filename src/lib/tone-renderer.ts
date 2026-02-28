import * as Tone from "tone";
import { MidiTrackData, MidiNote } from "@/types/midi";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createSynth(instrument: string): any {
  switch (instrument) {
    case "piano":
      // Triangle wave with fast attack + natural piano decay
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle8" },
        envelope: { attack: 0.005, decay: 0.5, sustain: 0.15, release: 1.5 },
      });

    case "bass":
      // FM synthesis for punchy, warm bass
      return new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 0.5,
        modulationIndex: 4,
        oscillator: { type: "triangle" },
        envelope: { attack: 0.005, decay: 0.2, sustain: 0.6, release: 0.4 },
        modulation: { type: "square" },
        modulationEnvelope: {
          attack: 0.005,
          decay: 0.15,
          sustain: 0.4,
          release: 0.3,
        },
      });

    case "pad":
      // Slow-attack AM synth for atmospheric pads
      return new Tone.PolySynth(Tone.AMSynth, {
        oscillator: { type: "sine4" },
        envelope: { attack: 1.5, decay: 0.5, sustain: 0.9, release: 3.0 },
        modulation: { type: "sine" },
        modulationEnvelope: {
          attack: 0.8,
          decay: 0.2,
          sustain: 0.8,
          release: 2.0,
        },
      });

    case "lead":
    case "melody":
      // Sawtooth with slight softness for a warm lead tone
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "sawtooth4" },
        envelope: { attack: 0.03, decay: 0.15, sustain: 0.6, release: 0.6 },
      });

    default:
      return new Tone.PolySynth(Tone.Synth);
  }
}

/** Reverb room sizes per instrument. Bass gets none (muddies low end). */
const REVERB_CONFIG: Record<
  string,
  { roomSize: number; dampening: number } | null
> = {
  piano: { roomSize: 0.35, dampening: 5000 },
  pad: { roomSize: 0.8, dampening: 3500 },
  lead: { roomSize: 0.25, dampening: 6000 },
  melody: { roomSize: 0.25, dampening: 6000 },
  bass: null,
};

export async function renderMidiToAudioBuffer(
  midiData: MidiTrackData,
  sampleRate: number = 44100
): Promise<AudioBuffer> {
  // +3s padding for reverb tails on atmospheric instruments
  const reverbConfig = REVERB_CONFIG[midiData.instrument] ?? null;
  const totalDuration = midiData.durationSeconds + (reverbConfig ? 3 : 2);

  const buffer = await Tone.Offline(
    ({ transport }) => {
      const synth = createSynth(midiData.instrument);
      const limiter = new Tone.Limiter(-3);

      if (reverbConfig) {
        const reverb = new Tone.Freeverb({
          roomSize: reverbConfig.roomSize,
          dampening: reverbConfig.dampening,
        });
        synth.connect(reverb);
        reverb.connect(limiter);
      } else {
        synth.connect(limiter);
      }

      limiter.toDestination();
      transport.bpm.value = midiData.bpm;

      for (const note of midiData.notes) {
        const time = Math.max(0, note.time);
        const duration = Math.max(0.01, note.duration);
        const velocity = Math.min(1, Math.max(0, note.velocity));
        synth.triggerAttackRelease(note.note, duration, time, velocity);
      }
    },
    totalDuration,
    2,
    sampleRate
  );

  // ToneAudioBuffer wraps a native AudioBuffer — extract it
  return buffer.get() as unknown as AudioBuffer;
}

export function validateMidiNotes(notes: MidiNote[]): string[] {
  const validNotePattern = /^[A-G][#b]?\d{1,2}$/;
  return notes.filter((n) => !validNotePattern.test(n.note)).map((n) => n.note);
}
