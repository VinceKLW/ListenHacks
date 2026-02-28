export interface Track {
  id: string;
  name: string;
  type: "hum" | "arrangement" | "beat" | "instrument";
  audioUrl: string | null;
  audioBuffer: AudioBuffer | null;
  volume: number; // 0-1
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
