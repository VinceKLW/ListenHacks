import * as Tone from "tone";
import { MidiTrackData, MidiNote } from "@/types/midi";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createSynth(instrument: string): any {
  switch (instrument) {
    case "piano":
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle8" },
        envelope: { attack: 0.01, decay: 0.3, sustain: 0.3, release: 0.8 },
      });

    case "bass":
      return new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 1,
        modulationIndex: 3,
        oscillator: { type: "sine" },
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.4 },
        modulation: { type: "square" },
        modulationEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.3 },
      });

    case "pad":
      return new Tone.PolySynth(Tone.AMSynth, {
        oscillator: { type: "sine" },
        envelope: { attack: 0.8, decay: 0.5, sustain: 0.8, release: 2.0 },
      });

    case "lead":
    case "melody":
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "sawtooth" },
        envelope: { attack: 0.02, decay: 0.1, sustain: 0.5, release: 0.3 },
      });

    default:
      return new Tone.PolySynth(Tone.Synth);
  }
}

export async function renderMidiToAudioBuffer(
  midiData: MidiTrackData,
  sampleRate: number = 44100
): Promise<AudioBuffer> {
  // Add 2s padding for release tails
  const totalDuration = midiData.durationSeconds + 2;

  const buffer = await Tone.Offline(
    ({ transport }) => {
      const synth = createSynth(midiData.instrument);
      const limiter = new Tone.Limiter(-3);
      synth.connect(limiter);
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
