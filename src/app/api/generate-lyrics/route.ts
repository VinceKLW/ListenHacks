import { NextRequest, NextResponse } from "next/server";

const DEFAULT_MODEL_ID = "eleven_multilingual_v2";

type VoiceInfo = {
  voice_id: string;
  name?: string;
};

async function resolveVoiceId(apiKey: string, requestedVoiceId?: string) {
  if (requestedVoiceId) return requestedVoiceId;

  const voicesRes = await fetch("https://api.elevenlabs.io/v1/voices", {
    method: "GET",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
  });

  if (!voicesRes.ok) return null;

  const data = (await voicesRes.json()) as { voices?: VoiceInfo[] };
  return data.voices?.[0]?.voice_id ?? null;
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

    const { lyrics, voiceId, voiceSettings } = await req.json();
    if (!lyrics || typeof lyrics !== "string" || !lyrics.trim()) {
      return NextResponse.json(
        { error: "Lyrics are required" },
        { status: 400 }
      );
    }

    const resolvedVoiceId = await resolveVoiceId(apiKey, voiceId?.trim());
    if (!resolvedVoiceId) {
      return NextResponse.json(
        { error: "No ElevenLabs voice available. Provide a voiceId." },
        { status: 400 }
      );
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${resolvedVoiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: lyrics,
          model_id: DEFAULT_MODEL_ID,
          voice_settings: {
            stability: 0.35,
            similarity_boost: 0.7,
            ...voiceSettings,
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("ElevenLabs TTS error:", response.status, errText);
      return NextResponse.json(
        { error: `ElevenLabs API error: ${response.status}` },
        { status: 502 }
      );
    }

    const audioArrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(audioArrayBuffer).toString("base64");

    return NextResponse.json({ audioBase64: base64, mimeType: "audio/mpeg" });
  } catch (error) {
    console.error("Generate lyrics error:", error);
    return NextResponse.json(
      { error: "Failed to generate lyrics" },
      { status: 500 }
    );
  }
}
