import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const DEFAULT_MODEL_ID = "music_v1";
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

function clampDurationSeconds(value: number) {
  if (!Number.isFinite(value)) return 20;
  return Math.max(3, Math.min(300, Math.round(value)));
}

async function describeMix(audioBase64: string, mimeType: string) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const result = await model.generateContent([
    {
      inlineData: {
        mimeType,
        data: audioBase64,
      },
    },
    `You are a music analyst. Describe the audio in 1-2 concise sentences.
Focus on mood, genre, BPM estimate, tempo feel, and instrumentation. Do not mention lyrics.
Return ONLY valid JSON with no markdown or extra text:
{
  "description": "<short description>",
  "mood": "<one of: happy, sad, energetic, calm, romantic, intense>",
  "genre": "<one of: pop, electronic, jazz, classical, hiphop, rock, rnb, lofi>",
  "bpm": <estimated BPM as integer between 60-180>,
  "tempoFeel": "<slow, mid, fast>",
  "instrumentation": "<short list of instruments>"
}`,
  ]);

  const text = result.response.text();
  const cleaned = text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
  return JSON.parse(cleaned) as {
    description?: string;
    mood?: string;
    genre?: string;
    bpm?: number;
    tempoFeel?: string;
    instrumentation?: string;
  };
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing ELEVENLABS_API_KEY" },
        { status: 500 }
      );
    }

    const { lyrics, stylePrompt, durationSeconds, mixAudioBase64, mixMimeType } =
      await req.json();
    if (!lyrics || typeof lyrics !== "string" || !lyrics.trim()) {
      return NextResponse.json(
        { error: "Lyrics are required" },
        { status: 400 }
      );
    }

    const duration = clampDurationSeconds(Number(durationSeconds));
    const style = typeof stylePrompt === "string" ? stylePrompt.trim() : "";
    let mixContext = "";
    let mixBpm: number | undefined;
    if (
      typeof mixAudioBase64 === "string" &&
      mixAudioBase64.length > 0 &&
      typeof mixMimeType === "string" &&
      mixMimeType.length > 0
    ) {
      try {
        const mixDesc = await describeMix(mixAudioBase64, mixMimeType);
        if (typeof mixDesc.bpm === "number" && Number.isFinite(mixDesc.bpm)) {
          mixBpm = Math.max(60, Math.min(180, Math.round(mixDesc.bpm)));
        }
        const parts = [
          mixDesc.description ? `Description: ${mixDesc.description}` : "",
          mixDesc.mood ? `Mood: ${mixDesc.mood}` : "",
          mixDesc.genre ? `Genre: ${mixDesc.genre}` : "",
          mixBpm ? `BPM: ${mixBpm}` : "",
          mixDesc.tempoFeel ? `Tempo: ${mixDesc.tempoFeel}` : "",
          mixDesc.instrumentation ? `Instrumentation: ${mixDesc.instrumentation}` : "",
        ].filter(Boolean);
        if (parts.length > 0) {
          mixContext = parts.join(" | ");
        }
      } catch (err) {
        console.error("Mix description error:", err);
      }
    }

    const bpm = mixBpm ?? 120;
    const barSeconds = (60 / bpm) * 4;
    const countInBars = 1;
    const countInSeconds = barSeconds * countInBars;
    const availableSeconds = Math.max(0, duration - countInSeconds);
    const lyricLines = lyrics
      .split("\n")
      .map((l: string) => l.trim())
      .filter(Boolean);
    const normalizedLines = lyricLines.length > 0 ? lyricLines : [lyrics.trim()];
    const lineCount = Math.max(1, normalizedLines.length);
    const lineSeconds = availableSeconds / lineCount;
    const lineSchedule = normalizedLines.map((line: string, index: number) => {
      const start = countInSeconds + index * lineSeconds;
      const end = start + lineSeconds;
      return `Line ${index + 1} (${start.toFixed(2)}-${end.toFixed(
        2
      )}s): ${line}`;
    });

    const prompt = [
      "Create an a cappella vocal performance with no background music.",
      `Timing: ${bpm} BPM in 4/4. Include a ${countInBars}-bar count-in.`,
      "Sing on the beat and stay aligned to the timing grid.",
      mixContext ? `Context from the current mix: ${mixContext}` : "",
      style ? `Style: ${style}` : "",
      "Lyrics:",
      lyrics.trim(),
      "Line timing:",
      ...lineSchedule,
    ]
      .filter(Boolean)
      .join("\n");

    const response = await fetch(
      "https://api.elevenlabs.io/v1/music/compose",
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model_id: DEFAULT_MODEL_ID,
          prompt,
          music_length_ms: duration * 1000,
          force_instrumental: false,
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("ElevenLabs music compose error:", response.status, errText);
      return NextResponse.json(
        { error: `ElevenLabs API error: ${response.status}` },
        { status: 502 }
      );
    }

    const audioArrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(audioArrayBuffer).toString("base64");
    const mimeType = response.headers.get("content-type") || "audio/mpeg";

    return NextResponse.json({ audioBase64: base64, mimeType });
  } catch (error) {
    console.error("Generate singing error:", error);
    return NextResponse.json(
      { error: "Failed to generate singing" },
      { status: 500 }
    );
  }
}
