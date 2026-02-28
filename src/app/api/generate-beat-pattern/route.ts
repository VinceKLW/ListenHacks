import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const DRUM_KEYS = [
  "kick",
  "snare",
  "closedhat",
  "openhat",
  "clap",
  "lowTom",
  "midTom",
  "rim",
] as const;

interface MelodyNote {
  note: string;
  time: number;
  duration: number;
  velocity: number;
}

/** Convert melody note times to a 16-step grid rhythm hint for the beat generator. */
function buildMelodyRhythmContext(melody: MelodyNote[], tempo: number): string {
  const stepDuration = 60 / tempo / 4; // seconds per 16th note

  // Map each note onset to its 16-step grid position
  const rawPositions = melody.map((n) =>
    Math.round(n.time / stepDuration) % 16
  );
  const positions = [...new Set(rawPositions)].sort((a, b) => a - b);

  // Strong downbeats (beat 1/2/3/4 of the bar: steps 0,4,8,12)
  const onDownbeats = positions.filter((p) => p % 4 === 0);
  // Syncopated/offbeat positions (odd 16th steps)
  const onOffbeats = positions.filter((p) => p % 2 !== 0);
  // Steps where melody is silent — good for hi-hat fills
  const silentSteps = Array.from({ length: 16 }, (_, i) => i)
    .filter((i) => !positions.includes(i))
    .slice(0, 10);

  return `
MELODY RHYTHM CONTEXT (derived from the user's actual hum):
- Melody note onsets fall on 16-step grid positions: [${positions.join(", ")}]
- Melody lands on strong downbeats (0,4,8,12) at: [${onDownbeats.join(", ")}]
- Melody is syncopated (offbeat/16th positions) at: [${onOffbeats.join(", ")}]
- Grid positions with NO melody (space for groove fills): [${silentSteps.join(", ")}]

Use this rhythm data to shape the beat so it LOCKS WITH the hum:
- Kick: anchor the downbeats the melody emphasizes; add syncopation where melody is on offbeats
- Snare/Clap: traditional backbeat (4,12) unless genre calls for syncopation
- Hi-Hats: fill the silent positions to create flow between melody notes
- If melody is dense (many hits), keep the beat focused; if sparse, the beat can be busier
`;
}

export async function POST(req: NextRequest) {
  try {
    const { key, tempo, mood, genre, melody } = await req.json();

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const melodyContext =
      Array.isArray(melody) && melody.length >= 4
        ? buildMelodyRhythmContext(melody as MelodyNote[], tempo)
        : "";

    const result = await model.generateContent(
      `You are a professional drum programmer AI.
Generate a 16-step drum pattern that perfectly matches this hummed song:

Song analysis:
- Key: ${key}
- Tempo: ${tempo} BPM
- Mood: ${mood}
- Genre: ${genre}
${melodyContext}
The beat MUST reflect the song's energy and genre. Base genre guidelines:
- hiphop/trap: kick on 0,8 with triplet fills; snare on 4,12; dense closed hats (0,2,4,6,8,10,12,14); occasional open hat offbeats; clap layer on snare
- pop: four-on-the-floor kick (0,4,8,12); snare on 4,12; steady closed hats every 2 steps; clean and driving
- electronic: four-on-the-floor kick; open hat on offbeats (2,6,10,14); clap on 4,12; minimal toms
- jazz: sparse kick (0,10); shuffle hi-hats; light snare on 4 with ghost notes; rims for texture
- lofi: loose kick (0,6,9); snare on 4,12 with slight delay feel; laid-back hats (0,4,8,12); room for breath
- rnb: syncopated kick (0,3,8,11); ghost snare notes; tight closed hats; clap on 4,12
- rock: kick on 0,8; powerful snare on 4,12; steady eighth-note hats; crash-like open hat on 0
- classical: very sparse — mostly rims or light toms for accents, almost no kick/snare

Mood adjustments:
- energetic/intense: more hits, busier hats, double-kick feel
- calm/sad: sparser pattern, fewer hits, more breathing room
- happy/romantic: bouncy feel, offbeat hats, light touch

Return ONLY valid JSON, no markdown, no explanation:
{
  "kick":      [16 values — each 0 or 1],
  "snare":     [16 values — each 0 or 1],
  "closedhat": [16 values — each 0 or 1],
  "openhat":   [16 values — each 0 or 1],
  "clap":      [16 values — each 0 or 1],
  "lowTom":    [16 values — each 0 or 1],
  "midTom":    [16 values — each 0 or 1],
  "rim":       [16 values — each 0 or 1]
}

Each array must have exactly 16 elements. Position 0 = beat 1. Be creative but musical.`
    );

    const text = result.response.text();
    const cleaned = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const raw = JSON.parse(cleaned) as Record<string, number[]>;

    // Normalise: ensure each key exists and has exactly 16 booleans
    const pattern = DRUM_KEYS.map((key) => {
      const row = raw[key] ?? [];
      return Array.from({ length: 16 }, (_, i) => Boolean(row[i]));
    });

    return NextResponse.json({ pattern });
  } catch (error) {
    console.error("generate-beat-pattern error:", error);
    return NextResponse.json(
      { error: "Failed to generate beat pattern" },
      { status: 500 }
    );
  }
}
