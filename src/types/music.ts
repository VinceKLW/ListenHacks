import type { TrackEffects } from "./effects";

export interface Track {
  id: string;
  name: string;
  type: "hum" | "arrangement" | "beat" | "instrument" | "midi";
  audioUrl: string | null;
  audioBuffer: AudioBuffer | null;
  volume: number; // 0-1
  muted: boolean;
  solo: boolean;
  color: string;
  isLoading: boolean;
  effects?: TrackEffects;
  pan?: number; // -1 (full left) to 1 (full right), default 0 (center)
}

export interface MusicalAnalysisNote {
  note: string;
  time: number;
  duration: number;
  velocity: number;
}

export interface MusicalAnalysis {
  key: string;
  tempo: number;
  mood: string;
  genre: string;
  description: string;
  /** Transcribed melody from the hum - used to align generated parts */
  melody?: MusicalAnalysisNote[];
  /** Length of the hum recording in seconds - generated tracks match this */
  durationSeconds?: number;
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
  instrument?: string;
}

export type AppStep = "record" | "analyzing" | "generating" | "studio";
