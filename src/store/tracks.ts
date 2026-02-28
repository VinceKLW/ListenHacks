import { create } from "zustand";
import { Track, MusicalAnalysis, AppStep } from "@/types/music";

export interface TimeSelection {
  id: string;
  start: number;
  end: number;
  trackId: string | null; // null = master timeline
}

interface TracksStore {
  step: AppStep;
  setStep: (step: AppStep) => void;

  tracks: Track[];
  analysis: MusicalAnalysis | null;
  humAudioBlob: Blob | null;

  isPlaying: boolean;
  selectedTrackId: string | null;
  timeSelections: TimeSelection[];

  setHumBlob: (blob: Blob) => void;
  setAnalysis: (analysis: MusicalAnalysis) => void;
  addTrack: (track: Track) => void;
  updateTrack: (id: string, updates: Partial<Track>) => void;
  removeTrack: (id: string) => void;
  setPlaying: (playing: boolean) => void;
  setSelectedTrackId: (id: string | null) => void;
  addTimeSelection: (sel: Omit<TimeSelection, "id">) => void;
  removeTimeSelection: (id: string) => void;
  clearTimeSelections: () => void;
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
  timeSelections: [],

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
      timeSelections: state.timeSelections.filter((s) => s.trackId !== id),
    })),

  setPlaying: (playing) => set({ isPlaying: playing }),
  setSelectedTrackId: (id) => set({ selectedTrackId: id }),

  addTimeSelection: (sel) =>
    set((state) => ({
      timeSelections: [...state.timeSelections, { ...sel, id: crypto.randomUUID() }],
    })),

  removeTimeSelection: (id) =>
    set((state) => ({
      timeSelections: state.timeSelections.filter((s) => s.id !== id),
    })),

  clearTimeSelections: () => set({ timeSelections: [] }),

  clearTracks: () =>
    set({ tracks: [], analysis: null, humAudioBlob: null, isPlaying: false, timeSelections: [] }),

  reset: () =>
    set({
      step: "record",
      tracks: [],
      analysis: null,
      humAudioBlob: null,
      isPlaying: false,
      selectedTrackId: null,
      timeSelections: [],
    }),
}));
