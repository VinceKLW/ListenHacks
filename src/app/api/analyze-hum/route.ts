import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { audioBase64, mimeType } = await req.json();

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: mimeType || "audio/webm",
          data: audioBase64,
        },
      },
      `You are a music analysis AI. Analyze this hummed melody carefully.
Listen for the pitch, rhythm, and emotional quality.

CRITICAL: Transcribe the hummed melody into exact note data. Capture the pitches the user sang
and their approximate timing. This melody will be used to generate accompaniment that matches
the user's hum - so accuracy matters. Use standard note format (e.g., "C4", "Eb3").
Estimate timing in seconds from the start of the recording. Duration in seconds for each note.

Return ONLY valid JSON with no markdown formatting, no code fences, no extra text:
{
  "key": "<key and scale, e.g. C major, A minor, F# major>",
  "tempo": <estimated BPM as integer between 60-180>,
  "mood": "<one of: happy, sad, energetic, calm, romantic, intense>",
  "genre": "<best fitting genre, one of: pop, electronic, jazz, classical, hiphop, rock, rnb, lofi>",
  "description": "<one sentence describing the melodic character>",
  "melody": [
    { "note": "C4", "time": 0.0, "duration": 0.5, "velocity": 0.8 },
    { "note": "E4", "time": 0.5, "duration": 0.25, "velocity": 0.7 }
  ]
}

The "melody" array must contain the transcribed notes of what the user hummed. Include at least 4 notes
and up to 60 notes. Times should be in seconds (0 to recording length). Use velocity 0.6-0.9.`,
    ]);

    const text = result.response.text();
    const cleaned = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const analysis = JSON.parse(cleaned);

    // Validate melody if present
    if (analysis.melody && Array.isArray(analysis.melody)) {
      analysis.melody = analysis.melody.filter(
        (n: { note?: string; time?: number; duration?: number; velocity?: number }) =>
          typeof n?.note === "string" &&
          typeof n?.time === "number" &&
          typeof n?.duration === "number" &&
          typeof n?.velocity === "number"
      );
      if (analysis.melody.length < 4) analysis.melody = undefined;
    } else {
      analysis.melody = undefined;
    }

    return NextResponse.json(analysis);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const err = error as { status?: number };
    console.error("Analyze hum error:", message, error);
    return NextResponse.json(
      { error: "Failed to analyze hum", detail: message },
      { status: err.status ?? 500 }
    );
  }
}
