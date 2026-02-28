import { Track } from "@/types/music";
import { getAudioContext, audioBufferToWavBlob } from "./audio-utils";

class Mixer {
  private sources: Map<string, AudioBufferSourceNode> = new Map();
  private gains: Map<string, GainNode> = new Map();
  private onEndCallback: (() => void) | null = null;
  private endTimeout: ReturnType<typeof setTimeout> | null = null;

  play(tracks: Track[], onEnd?: () => void) {
    this.stop();
    const ctx = getAudioContext();
    const startTime = ctx.currentTime + 0.05;
    this.onEndCallback = onEnd || null;

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
      source.start(startTime);

      if (track.audioBuffer.duration > maxDuration) {
        maxDuration = track.audioBuffer.duration;
      }

      this.sources.set(track.id, source);
      this.gains.set(track.id, gain);
    });

    if (maxDuration > 0 && this.onEndCallback) {
      const cb = this.onEndCallback;
      this.endTimeout = setTimeout(() => {
        cb();
      }, maxDuration * 1000 + 100);
    }
  }

  stop() {
    if (this.endTimeout) {
      clearTimeout(this.endTimeout);
      this.endTimeout = null;
    }
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

export const mixer = new Mixer();
