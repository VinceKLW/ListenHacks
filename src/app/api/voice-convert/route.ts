import { NextRequest, NextResponse } from "next/server";

const DEFAULT_MODEL_ID = "eleven_multilingual_sts_v2";

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

    const form = await req.formData();
    const audio = form.get("audio");
    const voiceId = form.get("voiceId");

    if (!audio || !(audio instanceof Blob)) {
      return NextResponse.json(
        { error: "Audio file is required" },
        { status: 400 }
      );
    }

    const resolvedVoiceId = await resolveVoiceId(
      apiKey,
      typeof voiceId === "string" ? voiceId.trim() : undefined
    );
    if (!resolvedVoiceId) {
      return NextResponse.json(
        { error: "No ElevenLabs voice available. Provide a voiceId." },
        { status: 400 }
      );
    }

    const outForm = new FormData();
    outForm.append("audio", audio, "guide.wav");
    outForm.append("model_id", DEFAULT_MODEL_ID);
    outForm.append(
      "voice_settings",
      JSON.stringify({
        stability: 0.35,
        similarity_boost: 0.7,
      })
    );

    const response = await fetch(
      `https://api.elevenlabs.io/v1/speech-to-speech/${resolvedVoiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
        },
        body: outForm,
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("ElevenLabs speech-to-speech error:", response.status, errText);
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
    console.error("Voice conversion error:", error);
    return NextResponse.json(
      { error: "Failed to convert voice" },
      { status: 500 }
    );
  }
}
