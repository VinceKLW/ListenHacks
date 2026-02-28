# HUM PRODUCER — Full Implementation Guide

> **Goal**: Build a complete AI music production web app. Users hum a melody → AI analyzes it → generates a full arrangement → users add layers via voice commands → mix and export a finished track.
>
> **IMPORTANT**: Implement EVERY file described below. Do not skip any file. Do not simplify or stub out functionality. This is a hackathon project — build the real thing.

---

## Step 0: Project Bootstrap

Run these commands in order. Do NOT skip any step.

```bash
# 1. Create Next.js project
npx create-next-app@latest hum-producer --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm

# 2. cd into the project
cd hum-producer

# 3. Install all dependencies
npm install @google/generative-ai wavesurfer.js zustand lucide-react uuid

# 4. Install shadcn
npx shadcn@latest init -d

# 5. Add shadcn components
npx shadcn@latest add button slider badge card
```

After bootstrap, copy this CLAUDE.md into `hum-producer/CLAUDE.md`.

Create `.env.local` at the project root:

```
GEMINI_API_KEY=
BEATOVEN_API_KEY=
ELEVENLABS_API_KEY=
```

---

## Step 1: next.config.ts

Replace `next.config.ts` entirely:

```typescript
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    // Needed for wavesurfer and audio processing
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
    };
    return config;
  },
};

export default nextConfig;
```

---

## Step 2: Types — `src/types/music.ts`

```typescript
export interface Track {
  id: string;
  name: string;
  type: "hum" | "arrangement" | "beat" | "instrument";
  audioUrl: string | null;
  audioBuffer: AudioBuffer | null;
  volume: number; // 0–1
  muted: boolean;
  solo: boolean;
  color: string;
  isLoading: boolean;
}

export interface MusicalAnalysis {
  key: string;
  tempo: number;
  mood: string;
  genre: string;
  description: string;
}

export interface VoiceCommand {
  action:
    | "add_beat"
    | "change_mood"
    | "add_instrument"
    | "remove_track"
    | "change_tempo"
    | "export";
  description: string;
  value?: string;
}

export type AppStep = "record" | "analyzing" | "generating" | "studio";
```

---

## Step 3: Zustand Store — `src/store/tracks.ts`

```typescript
import { create } from "zustand";
import { Track, MusicalAnalysis, AppStep } from "@/types/music";

interface TracksStore {
  // App state
  step: AppStep;
  setStep: (step: AppStep) => void;

  // Audio
  tracks: Track[];
  analysis: MusicalAnalysis | null;
  humAudioBlob: Blob | null;

  // Playback
  isPlaying: boolean;

  // Actions
  setHumBlob: (blob: Blob) => void;
  setAnalysis: (analysis: MusicalAnalysis) => void;
  addTrack: (track: Track) => void;
  updateTrack: (id: string, updates: Partial<Track>) => void;
  removeTrack: (id: string) => void;
  setPlaying: (playing: boolean) => void;
}

export const useTracksStore = create<TracksStore>((set) => ({
  step: "record",
  setStep: (step) => set({ step }),

  tracks: [],
  analysis: null,
  humAudioBlob: null,
  isPlaying: false,

  setHumBlob: (blob) => set({ humAudioBlob: blob }),
  setAnalysis: (analysis) => set({ analysis }),

  addTrack: (track) =>
    set((state) => ({ tracks: [...state.tracks, track] })),

  updateTrack: (id, updates) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
    })),

  removeTrack: (id) =>
    set((state) => ({
      tracks: state.tracks.filter((t) => t.id !== id),
    })),

  setPlaying: (playing) => set({ isPlaying: playing }),
}));
```

---

## Step 4: Audio Utilities — `src/lib/audio-utils.ts`

```typescript
let audioContextInstance: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!audioContextInstance) {
    audioContextInstance = new AudioContext({ sampleRate: 44100 });
  }
  if (audioContextInstance.state === "suspended") {
    audioContextInstance.resume();
  }
  return audioContextInstance;
}

export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Strip the data URL prefix to get raw base64
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function blobToAudioBuffer(blob: Blob): Promise<AudioBuffer> {
  const ctx = getAudioContext();
  const arrayBuffer = await blob.arrayBuffer();
  return ctx.decodeAudioData(arrayBuffer);
}

export async function urlToAudioBuffer(url: string): Promise<AudioBuffer> {
  const ctx = getAudioContext();
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  return ctx.decodeAudioData(arrayBuffer);
}

export async function base64ToAudioBuffer(
  base64: string,
  mimeType: string = "audio/mpeg"
): Promise<AudioBuffer> {
  const ctx = getAudioContext();
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return ctx.decodeAudioData(bytes.buffer);
}

export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = buffer.length * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);

  // WAV header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, totalSize - 8, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  // Interleave channels and write samples
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch));
  }

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}
```

---

## Step 5: Mixer — `src/lib/mixer.ts`

```typescript
import { Track } from "@/types/music";
import { getAudioContext, audioBufferToWavBlob } from "./audio-utils";

class Mixer {
  private sources: Map<string, AudioBufferSourceNode> = new Map();
  private gains: Map<string, GainNode> = new Map();
  private startTime: number = 0;
  private onEndCallback: (() => void) | null = null;

  play(tracks: Track[], onEnd?: () => void) {
    this.stop();
    const ctx = getAudioContext();
    this.startTime = ctx.currentTime + 0.05;
    this.onEndCallback = onEnd || null;

    // Check if any track has solo enabled
    const hasSolo = tracks.some((t) => t.solo);
    let maxDuration = 0;

    tracks.forEach((track) => {
      if (!track.audioBuffer) return;
      if (track.muted) return;
      if (hasSolo && !track.solo) return;

      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      source.buffer = track.audioBuffer;
      gain.gain.value = track.volume;
      source.connect(gain).connect(ctx.destination);
      source.start(this.startTime);

      if (track.audioBuffer.duration > maxDuration) {
        maxDuration = track.audioBuffer.duration;
      }

      this.sources.set(track.id, source);
      this.gains.set(track.id, gain);
    });

    // Set up end callback on the longest track
    if (maxDuration > 0 && this.onEndCallback) {
      const cb = this.onEndCallback;
      setTimeout(() => {
        cb();
      }, maxDuration * 1000 + 100);
    }
  }

  stop() {
    this.sources.forEach((source) => {
      try {
        source.stop();
      } catch {
        // Already stopped
      }
    });
    this.sources.clear();
    this.gains.clear();
  }

  setVolume(id: string, vol: number) {
    const ctx = getAudioContext();
    const gain = this.gains.get(id);
    if (gain) {
      gain.gain.setValueAtTime(vol, ctx.currentTime);
    }
  }

  async exportMix(tracks: Track[]): Promise<Blob> {
    const hasSolo = tracks.some((t) => t.solo);
    const activeTracks = tracks.filter((t) => {
      if (!t.audioBuffer) return false;
      if (t.muted) return false;
      if (hasSolo && !t.solo) return false;
      return true;
    });

    if (activeTracks.length === 0) {
      throw new Error("No active tracks to export");
    }

    const maxDuration = Math.max(
      ...activeTracks.map((t) => t.audioBuffer!.duration)
    );
    const sampleRate = 44100;
    const offlineCtx = new OfflineAudioContext(
      2,
      Math.ceil(maxDuration * sampleRate),
      sampleRate
    );

    activeTracks.forEach((track) => {
      const source = offlineCtx.createBufferSource();
      const gain = offlineCtx.createGain();
      source.buffer = track.audioBuffer!;
      gain.gain.value = track.volume;
      source.connect(gain).connect(offlineCtx.destination);
      source.start(0);
    });

    const renderedBuffer = await offlineCtx.startRendering();
    return audioBufferToWavBlob(renderedBuffer);
  }
}

// Singleton
export const mixer = new Mixer();
```

---

## Step 6: API Routes

### `src/app/api/analyze-hum/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { audioBase64, mimeType } = await req.json();

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

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
    // Clean potential markdown code fences
    const cleaned = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const analysis = JSON.parse(cleaned);

    return NextResponse.json(analysis);
  } catch (error) {
    console.error("Analyze hum error:", error);
    return NextResponse.json(
      { error: "Failed to analyze hum" },
      { status: 500 }
    );
  }
}
```

### `src/app/api/generate-track/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { key, tempo, mood, genre, description } = await req.json();

    const prompt = `${genre} music in ${key} at ${tempo} BPM, ${mood} mood. ${description || ""}`.trim();

    // Step 1: Create track task
    const createRes = await fetch(
      "https://public-api.beatoven.ai/api/v1/tracks",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.BEATOVEN_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: { text: prompt },
          format: "mp3",
          loopable: false,
          duration: 30000, // 30 seconds in ms
        }),
      }
    );

    if (!createRes.ok) {
      const errText = await createRes.text();
      console.error("Beatoven create error:", createRes.status, errText);
      return NextResponse.json(
        { error: `Beatoven API error: ${createRes.status}` },
        { status: 502 }
      );
    }

    const createData = await createRes.json();
    const taskId = createData.task_id;

    if (!taskId) {
      return NextResponse.json(
        { error: "No task_id returned from Beatoven" },
        { status: 502 }
      );
    }

    // Step 2: Poll for completion (max ~120 seconds)
    let trackUrl: string | null = null;
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 3000));

      const statusRes = await fetch(
        `https://public-api.beatoven.ai/api/v1/tracks/${taskId}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.BEATOVEN_API_KEY}`,
          },
        }
      );

      if (!statusRes.ok) continue;

      const statusData = await statusRes.json();

      if (statusData.status === "composed" && statusData.meta?.track_url) {
        trackUrl = statusData.meta.track_url;
        break;
      }

      if (statusData.status === "failed") {
        return NextResponse.json(
          { error: "Track generation failed" },
          { status: 502 }
        );
      }
    }

    if (!trackUrl) {
      return NextResponse.json(
        { error: "Track generation timed out" },
        { status: 504 }
      );
    }

    return NextResponse.json({ trackUrl });
  } catch (error) {
    console.error("Generate track error:", error);
    return NextResponse.json(
      { error: "Failed to generate track" },
      { status: 500 }
    );
  }
}
```

### `src/app/api/voice-command/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { audioBase64, mimeType } = await req.json();

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

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
- User says "add some trap drums" → {"action":"add_beat","description":"trap kick and hi-hat drum pattern, 4 bars loop"}
- User says "add a bass line" → {"action":"add_instrument","description":"deep bass line groove"}
- User says "make it more jazzy" → {"action":"change_mood","description":"jazz"}
- User says "add electric guitar" → {"action":"add_instrument","description":"electric guitar riff melody"}
- User says "add piano chords" → {"action":"add_instrument","description":"piano chord progression"}
- User says "export" or "download" → {"action":"export","description":"export final mix"}`,
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
```

### `src/app/api/generate-beat/route.ts`

```typescript
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
```

### `src/app/api/proxy-audio/route.ts`

This proxies external audio URLs to avoid CORS issues.

```typescript
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "Missing url param" }, { status: 400 });
  }

  try {
    const audioRes = await fetch(url);

    if (!audioRes.ok) {
      return NextResponse.json(
        { error: "Failed to fetch audio" },
        { status: 502 }
      );
    }

    const contentType =
      audioRes.headers.get("content-type") || "audio/mpeg";
    const buffer = await audioRes.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Proxy fetch failed" },
      { status: 500 }
    );
  }
}
```

---

## Step 7: Components

### `src/components/HumRecorder.tsx`

```tsx
"use client";

import { useState, useRef, useCallback } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTracksStore } from "@/store/tracks";
import { blobToBase64, blobToAudioBuffer } from "@/lib/audio-utils";
import { v4 as uuidv4 } from "uuid";

export default function HumRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const { step, setStep, setHumBlob, setAnalysis, addTrack, updateTrack } =
    useTracksStore();

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setHumBlob(blob);
        await processHum(blob);
      };

      mediaRecorder.start(100); // collect data every 100ms
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    } catch (err) {
      console.error("Mic access denied:", err);
      alert("Please allow microphone access to use Hum Producer.");
    }
  }, [setHumBlob]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const processHum = async (blob: Blob) => {
    setStep("analyzing");

    // Add hum track immediately
    const humTrackId = uuidv4();
    const humBuffer = await blobToAudioBuffer(blob);
    addTrack({
      id: humTrackId,
      name: "Your Hum",
      type: "hum",
      audioUrl: URL.createObjectURL(blob),
      audioBuffer: humBuffer,
      volume: 0.8,
      muted: false,
      solo: false,
      color: "#7c3aed",
      isLoading: false,
    });

    // Analyze with Gemini
    try {
      const audioBase64 = await blobToBase64(blob);
      const analyzeRes = await fetch("/api/analyze-hum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64, mimeType: "audio/webm" }),
      });

      if (!analyzeRes.ok) throw new Error("Analysis failed");
      const analysis = await analyzeRes.json();
      setAnalysis(analysis);

      // Generate arrangement
      setStep("generating");
      const arrangementTrackId = uuidv4();
      addTrack({
        id: arrangementTrackId,
        name: "AI Arrangement",
        type: "arrangement",
        audioUrl: null,
        audioBuffer: null,
        volume: 0.7,
        muted: false,
        solo: false,
        color: "#2563eb",
        isLoading: true,
      });

      const genRes = await fetch("/api/generate-track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(analysis),
      });

      if (!genRes.ok) throw new Error("Generation failed");
      const { trackUrl } = await genRes.json();

      // Fetch audio through proxy to avoid CORS
      const proxiedUrl = `/api/proxy-audio?url=${encodeURIComponent(trackUrl)}`;
      const audioRes = await fetch(proxiedUrl);
      const arrayBuffer = await audioRes.arrayBuffer();
      const audioCtx = new AudioContext();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

      updateTrack(arrangementTrackId, {
        audioUrl: proxiedUrl,
        audioBuffer: audioBuffer,
        isLoading: false,
      });

      setStep("studio");
    } catch (err) {
      console.error("Processing error:", err);
      // Still move to studio so user can at least hear their hum
      setStep("studio");
    }
  };

  if (step !== "record" && step !== "analyzing" && step !== "generating") {
    return null;
  }

  return (
    <div className="flex flex-col items-center gap-6 py-12">
      {step === "record" && (
        <>
          <h2 className="text-2xl font-bold text-white">Hum Your Melody</h2>
          <p className="text-gray-400 text-center max-w-md">
            Press record and hum a melody for 5-15 seconds.
            <br />
            We&apos;ll turn it into a full produced track.
          </p>

          <div className="relative">
            <Button
              size="lg"
              variant={isRecording ? "destructive" : "default"}
              className={`rounded-full w-24 h-24 ${
                isRecording
                  ? "bg-red-600 hover:bg-red-700 animate-pulse"
                  : "bg-violet-600 hover:bg-violet-700"
              }`}
              onClick={isRecording ? stopRecording : startRecording}
            >
              {isRecording ? (
                <Square className="w-8 h-8" />
              ) : (
                <Mic className="w-8 h-8" />
              )}
            </Button>
          </div>

          {isRecording && (
            <div className="text-red-400 font-mono text-lg">
              {Math.floor(recordingTime / 60)}:
              {String(recordingTime % 60).padStart(2, "0")}
            </div>
          )}

          {!isRecording && (
            <p className="text-gray-500 text-sm">Tap to start recording</p>
          )}
        </>
      )}

      {step === "analyzing" && (
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-violet-500 animate-spin" />
          <h2 className="text-xl font-semibold text-white">
            Analyzing your melody...
          </h2>
          <p className="text-gray-400">
            Detecting key, tempo, and mood with AI
          </p>
        </div>
      )}

      {step === "generating" && (
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
          <h2 className="text-xl font-semibold text-white">
            Generating arrangement...
          </h2>
          <p className="text-gray-400">
            Creating a full track based on your hum. This may take up to 60
            seconds.
          </p>
        </div>
      )}
    </div>
  );
}
```

### `src/components/TrackItem.tsx`

```tsx
"use client";

import { useRef, useEffect } from "react";
import { Volume2, VolumeX, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Track } from "@/types/music";
import { useTracksStore } from "@/store/tracks";
import WaveSurfer from "wavesurfer.js";

interface TrackItemProps {
  track: Track;
}

export default function TrackItem({ track }: TrackItemProps) {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const { updateTrack, removeTrack } = useTracksStore();

  useEffect(() => {
    if (!waveformRef.current || !track.audioBuffer) return;

    // Clean up previous instance
    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
    }

    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: track.color + "80",
      progressColor: track.color,
      cursorColor: "transparent",
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 48,
      interact: false,
      normalize: true,
    });

    // Load from AudioBuffer by creating a blob
    const audioCtx = new AudioContext();
    const length = track.audioBuffer.length;
    const numChannels = track.audioBuffer.numberOfChannels;
    const offlineCtx = new OfflineAudioContext(
      numChannels,
      length,
      track.audioBuffer.sampleRate
    );
    const source = offlineCtx.createBufferSource();
    source.buffer = track.audioBuffer;
    source.connect(offlineCtx.destination);
    source.start();
    offlineCtx.startRendering().then((rendered) => {
      // Use the peak data directly for visualization
      ws.load("", [rendered.getChannelData(0)], rendered.duration);
    });

    wavesurferRef.current = ws;

    return () => {
      ws.destroy();
    };
  }, [track.audioBuffer, track.color]);

  const typeColors: Record<string, string> = {
    hum: "bg-violet-600",
    arrangement: "bg-blue-600",
    beat: "bg-orange-600",
    instrument: "bg-emerald-600",
  };

  const typeIcons: Record<string, string> = {
    hum: "🎤",
    arrangement: "🎵",
    beat: "🥁",
    instrument: "🎸",
  };

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg bg-gray-900 border border-gray-800 ${
        track.muted ? "opacity-50" : ""
      }`}
    >
      {/* Track info */}
      <div className="flex items-center gap-2 w-40 shrink-0">
        <span className="text-lg">{typeIcons[track.type]}</span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-white truncate">
            {track.name}
          </p>
          <Badge
            className={`text-[10px] px-1.5 py-0 ${typeColors[track.type]}`}
          >
            {track.type}
          </Badge>
        </div>
      </div>

      {/* Waveform */}
      <div className="flex-1 min-w-0">
        {track.isLoading ? (
          <div className="flex items-center justify-center h-12">
            <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
            <span className="text-xs text-gray-500 ml-2">Generating...</span>
          </div>
        ) : (
          <div ref={waveformRef} className="w-full" />
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Mute */}
        <Button
          size="sm"
          variant={track.muted ? "destructive" : "outline"}
          className="w-8 h-8 p-0"
          onClick={() => updateTrack(track.id, { muted: !track.muted })}
        >
          {track.muted ? (
            <VolumeX className="w-3.5 h-3.5" />
          ) : (
            <Volume2 className="w-3.5 h-3.5" />
          )}
        </Button>

        {/* Solo */}
        <Button
          size="sm"
          variant={track.solo ? "default" : "outline"}
          className={`w-8 h-8 p-0 text-xs font-bold ${
            track.solo ? "bg-yellow-600 hover:bg-yellow-700" : ""
          }`}
          onClick={() => updateTrack(track.id, { solo: !track.solo })}
        >
          S
        </Button>

        {/* Volume slider */}
        <div className="w-20">
          <Slider
            value={[track.volume * 100]}
            max={100}
            step={1}
            onValueChange={([val]) =>
              updateTrack(track.id, { volume: val / 100 })
            }
            className="w-full"
          />
        </div>

        {/* Delete (not for hum) */}
        {track.type !== "hum" && (
          <Button
            size="sm"
            variant="ghost"
            className="w-8 h-8 p-0 text-gray-500 hover:text-red-500"
            onClick={() => removeTrack(track.id)}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
```

### `src/components/TrackList.tsx`

```tsx
"use client";

import { Play, Square, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTracksStore } from "@/store/tracks";
import { mixer } from "@/lib/mixer";
import TrackItem from "./TrackItem";
import { useState } from "react";

export default function TrackList() {
  const { tracks, analysis, isPlaying, setPlaying, step } = useTracksStore();
  const [isExporting, setIsExporting] = useState(false);

  if (step !== "studio") return null;

  const handlePlayStop = () => {
    if (isPlaying) {
      mixer.stop();
      setPlaying(false);
    } else {
      setPlaying(true);
      mixer.play(tracks, () => setPlaying(false));
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const wavBlob = await mixer.exportMix(tracks);
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hum-producer-mix-${Date.now()}.wav`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
      alert("Export failed. Make sure you have at least one active track.");
    }
    setIsExporting(false);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {/* Analysis info */}
      {analysis && (
        <div className="flex flex-wrap gap-2 justify-center">
          <Badge variant="outline" className="text-violet-400 border-violet-600">
            Key: {analysis.key}
          </Badge>
          <Badge variant="outline" className="text-blue-400 border-blue-600">
            {analysis.tempo} BPM
          </Badge>
          <Badge variant="outline" className="text-emerald-400 border-emerald-600">
            {analysis.mood}
          </Badge>
          <Badge variant="outline" className="text-orange-400 border-orange-600">
            {analysis.genre}
          </Badge>
        </div>
      )}

      {/* Header with controls */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Your Tracks</h2>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handlePlayStop}
            className={
              isPlaying
                ? "bg-red-600 hover:bg-red-700"
                : "bg-violet-600 hover:bg-violet-700"
            }
          >
            {isPlaying ? (
              <>
                <Square className="w-4 h-4 mr-1" /> Stop
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-1" /> Play All
              </>
            )}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-1" />
            )}
            Export WAV
          </Button>
        </div>
      </div>

      {/* Track items */}
      <div className="space-y-2">
        {tracks.map((track) => (
          <TrackItem key={track.id} track={track} />
        ))}
      </div>
    </div>
  );
}
```

### `src/components/VoiceCommandBar.tsx`

```tsx
"use client";

import { useState, useRef, useCallback } from "react";
import { Mic, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTracksStore } from "@/store/tracks";
import { blobToBase64, base64ToAudioBuffer } from "@/lib/audio-utils";
import { VoiceCommand } from "@/types/music";
import { v4 as uuidv4 } from "uuid";

export default function VoiceCommandBar() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const { step, addTrack, updateTrack, analysis } = useTracksStore();

  if (step !== "studio") return null;

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await processCommand(blob);
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setStatusText("Listening... say what to add");
    } catch (err) {
      console.error("Mic access error:", err);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const processCommand = async (blob: Blob) => {
    setIsProcessing(true);
    setStatusText("Understanding your command...");

    try {
      // Parse voice command with Gemini
      const audioBase64 = await blobToBase64(blob);
      const cmdRes = await fetch("/api/voice-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64, mimeType: "audio/webm" }),
      });

      if (!cmdRes.ok) throw new Error("Command parse failed");
      const command: VoiceCommand = await cmdRes.json();

      setStatusText(`Got it: "${command.description}"`);

      if (
        command.action === "add_beat" ||
        command.action === "add_instrument"
      ) {
        // Create a loading track
        const newTrackId = uuidv4();
        const trackType =
          command.action === "add_beat" ? "beat" : "instrument";
        const colors = {
          beat: "#ea580c",
          instrument: "#059669",
        };

        addTrack({
          id: newTrackId,
          name: command.description,
          type: trackType,
          audioUrl: null,
          audioBuffer: null,
          volume: 0.7,
          muted: false,
          solo: false,
          color: colors[trackType],
          isLoading: true,
        });

        setStatusText(`Generating: ${command.description}...`);

        // Generate with ElevenLabs
        const beatRes = await fetch("/api/generate-beat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: command.description,
            durationSeconds: 8,
          }),
        });

        if (!beatRes.ok) throw new Error("Beat generation failed");
        const { audioBase64: beatBase64 } = await beatRes.json();
        const audioBuffer = await base64ToAudioBuffer(beatBase64, "audio/mpeg");

        updateTrack(newTrackId, {
          audioBuffer,
          isLoading: false,
        });

        setStatusText(`Added: ${command.description}`);
      } else if (command.action === "change_mood" && analysis) {
        setStatusText(`Regenerating with mood: ${command.description}...`);
        // Could trigger a new Beatoven generation here
        // For now, just acknowledge
        setStatusText(`Mood noted: ${command.description}`);
      } else if (command.action === "export") {
        setStatusText("Use the Export button to download your mix.");
      }
    } catch (err) {
      console.error("Voice command error:", err);
      setStatusText("Failed to process command. Try again.");
    }

    setIsProcessing(false);

    // Clear status after a few seconds
    setTimeout(() => setStatusText(""), 4000);
  };

  return (
    <div className="w-full max-w-4xl mx-auto mt-6">
      <div className="flex flex-col items-center gap-3 p-6 rounded-xl bg-gray-900 border border-gray-800">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-400" />
          <h3 className="text-sm font-semibold text-gray-300">
            Add layers with your voice
          </h3>
        </div>

        <p className="text-xs text-gray-500 text-center">
          Say things like &quot;add trap drums&quot;, &quot;add a bass
          line&quot;, or &quot;add piano chords&quot;
        </p>

        <Button
          size="lg"
          disabled={isProcessing}
          className={`rounded-full w-16 h-16 ${
            isRecording
              ? "bg-red-600 hover:bg-red-700 animate-pulse"
              : isProcessing
                ? "bg-gray-700"
                : "bg-violet-600 hover:bg-violet-700"
          }`}
          onClick={isRecording ? stopRecording : startRecording}
        >
          {isProcessing ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <Mic className="w-6 h-6" />
          )}
        </Button>

        {statusText && (
          <p className="text-sm text-gray-400 animate-in fade-in">
            {statusText}
          </p>
        )}
      </div>
    </div>
  );
}
```

### `src/components/TextCommandBar.tsx`

This is a fallback for adding tracks via text input (no mic needed for quick testing).

```tsx
"use client";

import { useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTracksStore } from "@/store/tracks";
import { base64ToAudioBuffer } from "@/lib/audio-utils";
import { v4 as uuidv4 } from "uuid";

export default function TextCommandBar() {
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const { step, addTrack, updateTrack } = useTracksStore();

  if (step !== "studio") return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    const description = input.trim();
    setInput("");
    setIsProcessing(true);

    const newTrackId = uuidv4();
    const isBeat =
      description.toLowerCase().includes("drum") ||
      description.toLowerCase().includes("beat") ||
      description.toLowerCase().includes("percussion") ||
      description.toLowerCase().includes("hi-hat") ||
      description.toLowerCase().includes("kick");

    addTrack({
      id: newTrackId,
      name: description,
      type: isBeat ? "beat" : "instrument",
      audioUrl: null,
      audioBuffer: null,
      volume: 0.7,
      muted: false,
      solo: false,
      color: isBeat ? "#ea580c" : "#059669",
      isLoading: true,
    });

    try {
      const beatRes = await fetch("/api/generate-beat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          durationSeconds: 8,
        }),
      });

      if (!beatRes.ok) throw new Error("Generation failed");
      const { audioBase64 } = await beatRes.json();
      const audioBuffer = await base64ToAudioBuffer(audioBase64, "audio/mpeg");

      updateTrack(newTrackId, {
        audioBuffer,
        isLoading: false,
      });
    } catch (err) {
      console.error("Text command error:", err);
      updateTrack(newTrackId, { isLoading: false, name: `${description} (failed)` });
    }

    setIsProcessing(false);
  };

  return (
    <div className="w-full max-w-4xl mx-auto mt-3">
      <form
        onSubmit={handleSubmit}
        className="flex gap-2 p-3 rounded-lg bg-gray-900 border border-gray-800"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='Or type: "trap drums", "piano chords", "bass line"...'
          className="flex-1 bg-transparent text-white text-sm placeholder:text-gray-600 outline-none"
          disabled={isProcessing}
        />
        <Button
          type="submit"
          size="sm"
          disabled={!input.trim() || isProcessing}
          className="bg-violet-600 hover:bg-violet-700"
        >
          {isProcessing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </form>
    </div>
  );
}
```

---

## Step 8: Main Page — `src/app/page.tsx`

```tsx
import HumRecorder from "@/components/HumRecorder";
import TrackList from "@/components/TrackList";
import VoiceCommandBar from "@/components/VoiceCommandBar";
import TextCommandBar from "@/components/TextCommandBar";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎵</span>
            <h1 className="text-xl font-bold bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
              HUM PRODUCER
            </h1>
          </div>
          <span className="text-xs text-gray-600 font-mono">
            ListenHacks 2025
          </span>
        </div>
      </header>

      {/* Content */}
      <div className="px-6 py-8">
        <HumRecorder />
        <TrackList />
        <VoiceCommandBar />
        <TextCommandBar />
      </div>
    </main>
  );
}
```

---

## Step 9: Layout — `src/app/layout.tsx`

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Hum Producer - AI Music Production",
  description:
    "Hum a melody, get a full produced track. AI-powered music production.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-gray-950 antialiased`}>
        {children}
      </body>
    </html>
  );
}
```

---

## Step 10: Global CSS additions — `src/app/globals.css`

Keep all existing Tailwind directives. Add at the end:

```css
/* Add after existing content */

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: #0a0a0a;
}
::-webkit-scrollbar-thumb {
  background: #333;
  border-radius: 3px;
}

/* Pulse animation for recording */
@keyframes recording-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5);
  }
  50% {
    box-shadow: 0 0 0 16px rgba(239, 68, 68, 0);
  }
}

.recording-pulse {
  animation: recording-pulse 1.5s ease-in-out infinite;
}
```

---

## Complete File Checklist

Create ALL of these files:

- [ ] `next.config.ts` — WASM support
- [ ] `.env.local` — API keys (user fills in)
- [ ] `src/types/music.ts` — Type definitions
- [ ] `src/store/tracks.ts` — Zustand store
- [ ] `src/lib/audio-utils.ts` — Audio helper functions
- [ ] `src/lib/mixer.ts` — Multi-track mixer singleton
- [ ] `src/app/api/analyze-hum/route.ts` — Gemini analysis
- [ ] `src/app/api/generate-track/route.ts` — Beatoven.ai generation
- [ ] `src/app/api/voice-command/route.ts` — Gemini voice parsing
- [ ] `src/app/api/generate-beat/route.ts` — ElevenLabs sound effects
- [ ] `src/app/api/proxy-audio/route.ts` — CORS proxy
- [ ] `src/components/HumRecorder.tsx` — Mic recording + processing pipeline
- [ ] `src/components/TrackItem.tsx` — Single track row with waveform
- [ ] `src/components/TrackList.tsx` — Track container + play/export controls
- [ ] `src/components/VoiceCommandBar.tsx` — Voice command interface
- [ ] `src/components/TextCommandBar.tsx` — Text input for adding tracks
- [ ] `src/app/page.tsx` — Main page assembly
- [ ] `src/app/layout.tsx` — Root layout (dark theme)
- [ ] `src/app/globals.css` — Add custom scrollbar + animations

---

## Implementation Order

1. Bootstrap Next.js project and install deps (Step 0)
2. Configure `next.config.ts` (Step 1)
3. Create types (Step 2)
4. Create store (Step 3)
5. Create `audio-utils.ts` and `mixer.ts` (Steps 4-5)
6. Create all API routes (Step 6)
7. Create components: HumRecorder, TrackItem, TrackList, VoiceCommandBar, TextCommandBar (Step 7)
8. Create page.tsx and layout.tsx (Steps 8-9)
9. Update globals.css (Step 10)
10. Run `npm run dev` and test

---

## Verification Checklist

After building, verify:

- [ ] `npm run dev` starts without errors
- [ ] App loads at localhost:3000 with dark theme
- [ ] Record button requests mic permission
- [ ] After recording, hum blob is sent to Gemini and analysis JSON is returned
- [ ] Beatoven.ai track generation starts and polls correctly
- [ ] Hum waveform appears in track list
- [ ] AI arrangement loads and shows waveform
- [ ] Play All plays all unmuted tracks simultaneously
- [ ] Mute/Solo/Volume controls work
- [ ] Voice command records, parses, and triggers ElevenLabs generation
- [ ] Text input generates beats via ElevenLabs
- [ ] New tracks appear with loading state then waveform
- [ ] Export downloads a .wav file
- [ ] No TypeScript errors, no console errors on page load

---

## Troubleshooting

- **WASM errors**: Make sure `next.config.ts` has `asyncWebAssembly: true`
- **CORS on Beatoven URLs**: Use the `/api/proxy-audio` route
- **Gemini returns markdown**: The code strips ` ```json ` fences — if still failing, check the raw response
- **MediaRecorder not supported**: Use Chrome or Edge, not Firefox (WebM/Opus support)
- **AudioContext suspended**: Call `getAudioContext()` from a click handler (user gesture required)
- **ElevenLabs 401**: Check `ELEVENLABS_API_KEY` in `.env.local`
- **Beatoven timeout**: The 120s polling might not be enough for complex prompts — check the Beatoven dashboard

---

## Key Architecture Decisions

1. **All AI calls go through API routes** — never expose API keys to the browser
2. **AudioBuffers stored in Zustand** — not serializable but fine for in-memory state; don't persist
3. **Mixer is a singleton** — one instance manages all Web Audio nodes
4. **Waveforms via wavesurfer.js** — lightweight, no-dependency waveform rendering
5. **Voice commands use same Gemini model** — single API key for analysis + command parsing
6. **Text command bar as fallback** — faster iteration during development and demo
7. **Proxy route for external audio** — avoids CORS issues with Beatoven.ai URLs
8. **UUID for track IDs** — prevents collisions when adding multiple tracks rapidly
