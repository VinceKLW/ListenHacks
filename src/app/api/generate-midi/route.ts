import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const {
      key,
      tempo,
      mood,
      genre,
      instrument,
      durationSeconds,
      melody,
    } = await req.json();

    if (!key || !tempo || !instrument) {
      return NextResponse.json(
        { error: "Missing required fields: key, tempo, instrument" },
        { status: 400 }
      );
    }

    const duration = Math.max(1.0, durationSeconds || 16);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" },
    });

    const prompt = buildMidiPrompt({
      key,
      tempo,
      mood,
      genre,
      instrument,
      duration,
      melody: Array.isArray(melody) && melody.length >= 4 ? melody : undefined,
    });

    const result = await model.generateContent(prompt);
    const midiData = JSON.parse(result.response.text());

    // Validate structure
    if (
      !midiData.notes ||
      !Array.isArray(midiData.notes) ||
      midiData.notes.length === 0
    ) {
      return NextResponse.json(
        { error: "Gemini returned invalid MIDI data: no notes array" },
        { status: 502 }
      );
    }

    for (const note of midiData.notes) {
      if (
        typeof note.note !== "string" ||
        typeof note.time !== "number" ||
        typeof note.duration !== "number" ||
        typeof note.velocity !== "number"
      ) {
        return NextResponse.json(
          { error: "Gemini returned malformed note data" },
          { status: 502 }
        );
      }
    }

    return NextResponse.json(midiData);
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("Generate MIDI error:", error);
    return NextResponse.json(
      { error: err.message || "Failed to generate MIDI data" },
      { status: 500 }
    );
  }
}

interface MelodyNote {
  note: string;
  time: number;
  duration: number;
  velocity: number;
}

function buildMidiPrompt(params: {
  key: string;
  tempo: number;
  mood: string;
  genre: string;
  instrument: string;
  duration: number;
  melody?: MelodyNote[];
}): string {
  const { key, tempo, mood, genre, instrument, duration, melody } = params;

  const melodyContext = melody
    ? `\n\nUSER'S HUMMED MELODY (use this to align your part - the user sang these exact notes):
${JSON.stringify(melody)}

Your generated part MUST harmonize with, support, or derive from this melody. Do not ignore it.\n`
    : "";

  const instrumentGuidance: Record<string, string> = {
    piano: melody
      ? `Generate a piano chord progression that HARMONIZES WITH the user's hummed melody above.
Place chords under the melody notes - support each melodic phrase with appropriate chords.
Use 3-4 note chords (triads or 7ths). Chords should align with the melody timing.
Use chord tones that fit the key of ${key} and the melody. For ${genre} style voicings.`
      : `Generate a piano chord progression. Use 3-4 note chords (triads or 7ths).
Place chords on beats 1 and 3 (or appropriate rhythmic positions for the genre).
Each chord should last 0.5-2 beats. Use chord tones that fit the key of ${key}.
For ${genre} style, use idiomatic voicings.`,

    bass: melody
      ? `Generate a bass line that SUPPORTS the user's hummed melody above.
Use the harmonic roots implied by the melody - bass notes should match the chord roots
that would harmonize with the melody. Use ONLY single notes in octaves 1-3 (e.g., C2, E2, G1).
Align bass rhythm with the melody's phrasing. Notes legato (0.3-0.8 sec). Key: ${key}.`
      : `Generate a bass line. Use ONLY single notes in octaves 1-3 (e.g., C2, E2, G1).
Follow the root notes of a typical ${genre} chord progression in ${key}.
Place notes on strong beats with occasional passing tones. Keep it rhythmically simple
and groovy. Notes should be legato (duration 0.3-0.8 seconds typically).`,

    pad: melody
      ? `Generate sustained pad chords that SUPPORT the user's hummed melody above.
Use chords that harmonize with the melody - create a warm bed under the melodic content.
3-4 note chords, long durations (2-4 sec). Octaves 3-5. Overlap for smooth transitions.
Create a warm, atmospheric ${mood} feeling. Key: ${key}.`
      : `Generate sustained pad chords. Use 3-4 note chords with long durations (2-4 seconds each).
Notes should be in octaves 3-5. Overlap slightly for smooth transitions.
Create a warm, atmospheric ${mood} feeling. Use diatonic chords in ${key}.`,

    lead: melody
      ? `The user hummed a melody - USE IT. Your lead part should be the transcribed melody above.
You may: add light ornamentation, octave doublings, or slight rhythmic variations.
But the core pitches and contour MUST match what the user sang. Do not invent a different melody.
Use the exact notes from the melody array, adjusting timing to the tempo grid if needed.`
      : `Generate a lead melody line. Use ONLY single notes in octaves 4-5.
Create a memorable, singable melody that fits the ${mood} mood.
Mix quarter notes, eighth notes, and occasional held notes.
Leave some rests (gaps between notes) for breathing room.
Stay within the ${key} scale.`,

    melody: melody
      ? `Generate a counter-melody that COMPLEMENTS the user's hummed melody above.
Your line should weave around the main melody - use harmonies (3rds, 6ths), call-and-response,
or fill gaps between melody notes. Do NOT duplicate the melody. Stay in octaves 3-5.
Use syncopation. Key: ${key}, genre: ${genre}.`
      : `Generate a counter-melody or secondary melodic line. Use single notes in octaves 3-5.
Make it complementary (not identical) to a typical melody. Use syncopation and
rhythmic variation. Stay in ${key} and fit the ${genre} style.`,
  };

  const guidance = instrumentGuidance[instrument] || instrumentGuidance["lead"];
  const beatsTotal = (tempo / 60) * duration;

  return `You are a professional music composer AI. Generate MIDI-like note data for a ${instrument} part.
${melodyContext}
Musical context:
- Key: ${key}
- Tempo: ${tempo} BPM
- Mood: ${mood}
- Genre: ${genre}
- Duration: ${duration} seconds (approximately ${Math.round(beatsTotal)} beats)
- Time signature: 4/4

Instrument-specific guidance:
${guidance}

CRITICAL RULES:
1. All note times must be between 0 and ${duration} seconds
2. Note names must use standard format: C, D, E, F, G, A, B with optional # or b and octave number (e.g., "C4", "Eb3", "F#5")
3. Velocity values must be between 0.0 and 1.0 (use 0.5-0.9 for most notes)
4. Keep the part musically coherent and rhythmically aligned to the tempo grid
5. Generate at least ${Math.max(4, Math.min(16, Math.round(duration * 2)))} notes and no more than 200 notes
6. Times should align to the beat grid: one beat = ${(60 / tempo).toFixed(4)} seconds

Return ONLY valid JSON with no markdown formatting, no code fences, no extra text:
{
  "instrument": "${instrument}",
  "bpm": ${tempo},
  "key": "${key}",
  "timeSignature": "4/4",
  "durationSeconds": ${duration},
  "notes": [
    { "note": "C4", "time": 0.0, "duration": 0.5, "velocity": 0.8 },
    { "note": "E4", "time": 0.0, "duration": 0.5, "velocity": 0.7 }
  ]
}`;
}
