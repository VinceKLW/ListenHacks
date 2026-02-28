import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { description, durationSeconds } = await req.json();

    const response = await fetch(
      "https://api.elevenlabs.io/v1/sound-generation",
      {
        method: "POST",
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: description,
          duration_seconds: durationSeconds || 8.0,
          prompt_influence: 0.5,
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("ElevenLabs error:", response.status, errText);
      return NextResponse.json(
        { error: `ElevenLabs API error: ${response.status}` },
        { status: 502 }
      );
    }

    const audioArrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(audioArrayBuffer).toString("base64");

    return NextResponse.json({ audioBase64: base64, mimeType: "audio/mpeg" });
  } catch (error) {
    console.error("Generate beat error:", error);
    return NextResponse.json(
      { error: "Failed to generate beat" },
      { status: 500 }
    );
  }
}
