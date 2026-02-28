import { streamText, tool, stepCountIs, convertToModelMessages } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import type { UIMessage } from "ai";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

export const maxDuration = 30;

interface TrackInfo {
  id: string;
  name: string;
  type: string;
  muted: boolean;
  solo: boolean;
  volume: number;
  isLoading: boolean;
}

interface AnalysisInfo {
  key: string;
  tempo: number;
  mood: string;
  genre: string;
}

export async function POST(req: Request) {
  const {
    messages,
    tracks,
    analysis,
  }: {
    messages: UIMessage[];
    tracks: TrackInfo[];
    analysis: AnalysisInfo | null;
  } = await req.json();

  const trackList =
    tracks.length > 0
      ? tracks
          .map(
            (t) =>
              `  - id="${t.id}" name="${t.name}" type=${t.type} vol=${t.volume.toFixed(2)} muted=${t.muted} solo=${t.solo}`
          )
          .join("\n")
      : "  (no tracks yet)";

  const analysisCtx = analysis
    ? `Song analysis: key=${analysis.key} | ${analysis.tempo} BPM | mood=${analysis.mood} | genre=${analysis.genre}`
    : "No song analysis yet (user has not recorded a hum).";

  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: google("gemini-2.5-flash"),
    system: `You are an AI assistant for Hum Producer, a browser-based DAW (Digital Audio Workstation).
You help users manage tracks and generate new audio layers.

${analysisCtx}

Current tracks:
${trackList}

You can use tools to:
- findTrack — look up a track's ID by name or type keyword
- generateBeat — add a new percussion/beat track (drums, kicks, claps, hi-hats)
- generateInstrument — add a melodic MIDI track (piano, bass, pad, lead, melody) — requires a hum to be recorded first
- muteTrack — mute or unmute a track
- soloTrack — solo or unsolo a track
- setVolume — set a track's volume (0.0–1.0)
- removeTrack — delete a track

Rules:
- If the user refers to a track by name and you don't see a clear ID, use findTrack first.
- Be concise: one sentence confirmation after each action.
- If generateInstrument is requested but there's no song analysis, explain they need to record a hum first.`,

    messages: modelMessages,

    tools: {
      // Server-side: can execute because we have tracks in the request body
      findTrack: tool({
        description:
          "Find tracks by name or type keyword. Returns matching track IDs and names.",
        inputSchema: z.object({
          query: z
            .string()
            .describe(
              'Name or type keyword to search for, e.g. "bass", "drums", "hum", "piano"'
            ),
        }),
        execute: async ({ query }) => {
          const q = query.toLowerCase();
          const matches = tracks.filter(
            (t) =>
              t.name.toLowerCase().includes(q) ||
              t.type.toLowerCase().includes(q)
          );
          if (matches.length === 0)
            return { found: false, message: `No tracks matching "${query}"` };
          return {
            found: true,
            tracks: matches.map((t) => ({
              id: t.id,
              name: t.name,
              type: t.type,
            })),
          };
        },
      }),

      // Client-side tools (no execute — browser handles them via onToolCall)
      generateBeat: tool({
        description:
          "Generate a new percussion/beat track (drums, kicks, claps, hi-hats, etc.)",
        inputSchema: z.object({
          description: z
            .string()
            .describe(
              'What to generate, e.g. "trap kick and hi-hat pattern", "punchy snare"'
            ),
        }),
      }),

      generateInstrument: tool({
        description:
          "Generate a melodic MIDI instrument track. Only works after a hum has been recorded.",
        inputSchema: z.object({
          instrument: z
            .enum(["piano", "bass", "pad", "lead", "melody"])
            .describe("Instrument type"),
          description: z
            .string()
            .describe(
              'Description of the part, e.g. "piano chord progression", "deep bass groove"'
            ),
        }),
      }),

      muteTrack: tool({
        description: "Mute or unmute a track by its ID",
        inputSchema: z.object({
          trackId: z
            .string()
            .describe("Track ID (use findTrack first if unsure)"),
          muted: z.boolean().describe("true to mute, false to unmute"),
        }),
      }),

      soloTrack: tool({
        description: "Solo or unsolo a track by its ID",
        inputSchema: z.object({
          trackId: z.string().describe("Track ID"),
          solo: z.boolean().describe("true to solo, false to unsolo"),
        }),
      }),

      setVolume: tool({
        description: "Set a track's volume",
        inputSchema: z.object({
          trackId: z.string().describe("Track ID"),
          volume: z
            .number()
            .min(0)
            .max(1)
            .describe("Volume from 0.0 (silent) to 1.0 (full)"),
        }),
      }),

      removeTrack: tool({
        description: "Remove/delete a track from the project",
        inputSchema: z.object({
          trackId: z.string().describe("Track ID to remove"),
        }),
      }),
    },

    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse();
}
