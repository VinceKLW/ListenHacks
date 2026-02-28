import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { audioBase64, mimeType } = await req.json();

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: mimeType || "audio/webm",
          data: audioBase64,
        },
      },
      `You are a music analysis AI. Analyze this hummed melody carefully.
Listen for the pitch, rhythm, and emotional quality.

Return ONLY valid JSON with no markdown formatting, no code fences, no extra text:
{
  "key": "<key and scale, e.g. C major, A minor, F# major>",
  "tempo": <estimated BPM as integer between 60-180>,
  "mood": "<one of: happy, sad, energetic, calm, romantic, intense>",
  "genre": "<best fitting genre, one of: pop, electronic, jazz, classical, hiphop, rock, rnb, lofi>",
  "description": "<one sentence describing the melodic character>"
}`,
    ]);

    const text = result.response.text();
    const cleaned = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const analysis = JSON.parse(cleaned);

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
