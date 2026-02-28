import { create } from "zustand";
import { Track, MusicalAnalysis, AppStep } from "@/types/music";

interface TracksStore {
  step: AppStep;
  setStep: (step: AppStep) => void;

  tracks: Track[];
  analysis: MusicalAnalysis | null;
  humAudioBlob: Blob | null;

  isPlaying: boolean;
  selectedTrackId: string | null;
  timeSelection: { start: number; end: number; trackId: string | null } | null;

  setHumBlob: (blob: Blob) => void;
  setAnalysis: (analysis: MusicalAnalysis) => void;
  addTrack: (track: Track) => void;
  updateTrack: (id: string, updates: Partial<Track>) => void;
  removeTrack: (id: string) => void;
  setPlaying: (playing: boolean) => void;
  setSelectedTrackId: (id: string | null) => void;
  setTimeSelection: (sel: { start: number; end: number; trackId: string | null } | null) => void;
  clearTracks: () => void;
  reset: () => void;
}

export const useTracksStore = create<TracksStore>((set) => ({
  step: "record",
  setStep: (step) => set({ step }),

  tracks: [],
  analysis: null,
  humAudioBlob: null,
  isPlaying: false,
  selectedTrackId: null,
  timeSelection: null,

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
      selectedTrackId: state.selectedTrackId === id ? null : state.selectedTrackId,
    })),

  setPlaying: (playing) => set({ isPlaying: playing }),
  setSelectedTrackId: (id) => set({ selectedTrackId: id }),
  setTimeSelection: (sel) => set({ timeSelection: sel }),

  clearTracks: () =>
    set({ tracks: [], analysis: null, humAudioBlob: null, isPlaying: false, timeSelection: null }),

  reset: () =>
    set({
      step: "record",
      tracks: [],
      analysis: null,
      humAudioBlob: null,
      isPlaying: false,
      selectedTrackId: null,
      timeSelection: null,
    }),
}));
