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
      `You are a voice command parser for a music production app.
The user is giving a voice command about what to add or change in their music project.

Listen to their speech and extract the command. Return ONLY valid JSON with no markdown:
{
  "action": "<one of: add_beat, add_instrument, change_mood, remove_track, change_tempo, export>",
  "description": "<clear description of the sound or change requested>",
  "value": "<optional numeric or string value, e.g. tempo number>"
}

Examples of expected outputs:
- User says "add some trap drums" -> {"action":"add_beat","description":"trap kick and hi-hat drum pattern, 4 bars loop"}
- User says "add a bass line" -> {"action":"add_instrument","description":"deep bass line groove"}
- User says "make it more jazzy" -> {"action":"change_mood","description":"jazz"}
- User says "add electric guitar" -> {"action":"add_instrument","description":"electric guitar riff melody"}
- User says "add piano chords" -> {"action":"add_instrument","description":"piano chord progression"}
- User says "export" or "download" -> {"action":"export","description":"export final mix"}`,
    ]);

    const text = result.response.text();
    const cleaned = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const command = JSON.parse(cleaned);

    return NextResponse.json(command);
  } catch (error) {
    console.error("Voice command error:", error);
    return NextResponse.json(
      { error: "Failed to parse voice command" },
      { status: 500 }
    );
  }
}
