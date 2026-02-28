import { create } from "zustand";
import { Track, MusicalAnalysis, AppStep } from "@/types/music";

interface TracksStore {
  step: AppStep;
  setStep: (step: AppStep) => void;

  tracks: Track[];
  analysis: MusicalAnalysis | null;
  humAudioBlob: Blob | null;

  isPlaying: boolean;

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
