import { Track } from "@/types/music";
import { getAudioContext, audioBufferToWavBlob } from "./audio-utils";

class Mixer {
  private sources: Map<string, AudioBufferSourceNode> = new Map();
  private gains: Map<string, GainNode> = new Map();
  private _panners: Map<string, StereoPannerNode> = new Map();
  private _masterGain: GainNode | null = null;
  private onEndCallback: (() => void) | null = null;
  private endTimeout: ReturnType<typeof setTimeout> | null = null;
  private _startContextTime: number = 0;
  private _startOffset: number = 0;
  private _duration: number = 0;
  private _positionCallbacks: Set<(pos: number) => void> = new Set();
  private _positionInterval: ReturnType<typeof setInterval> | null = null;

  get duration() {
    return this._duration;
  }

  get currentPosition(): number {
    if (this._startContextTime === 0) return this._startOffset;
    const ctx = getAudioContext();
    const elapsed = ctx.currentTime - this._startContextTime;
    return Math.min(this._startOffset + elapsed, this._duration);
  }

  onPositionUpdate(cb: (pos: number) => void) {
    this._positionCallbacks.add(cb);
    return () => { this._positionCallbacks.delete(cb); };
  }

  private startPositionTracking() {
    this.stopPositionTracking();
    this._positionInterval = setInterval(() => {
      const pos = this.currentPosition;
      this._positionCallbacks.forEach((cb) => cb(pos));
    }, 50);
  }

  private stopPositionTracking() {
    if (this._positionInterval) {
      clearInterval(this._positionInterval);
      this._positionInterval = null;
    }
  }

  /** Lazy-initialize master gain node; permanently connected to destination */
  private getMasterGain(): GainNode {
    if (!this._masterGain) {
      const ctx = getAudioContext();
      this._masterGain = ctx.createGain();
      this._masterGain.gain.value = 0.8;
      this._masterGain.connect(ctx.destination);
    }
    return this._masterGain;
  }

  play(tracks: Track[], onEnd?: () => void, offset: number = 0) {
    this.stop();
    const ctx = getAudioContext();
    const startTime = ctx.currentTime + 0.05;
    this.onEndCallback = onEnd || null;
    this._startContextTime = startTime;
    this._startOffset = offset;

    const hasSolo = tracks.some((t) => t.solo);
    let maxDuration = 0;

    tracks.forEach((track) => {
      if (!track.audioBuffer) return;
      if (track.muted) return;
      if (hasSolo && !track.solo) return;

      const source = ctx.createBufferSource();
      const panner = ctx.createStereoPanner();
      const gain = ctx.createGain();

      source.buffer = track.audioBuffer;
      panner.pan.value = track.pan ?? 0;
      gain.gain.value = track.volume;

      source.connect(panner).connect(gain).connect(this.getMasterGain());

      const trackDuration = track.audioBuffer.duration;
      if (offset < trackDuration) {
        source.start(startTime, offset);
      }

      if (trackDuration > maxDuration) {
        maxDuration = trackDuration;
      }

      this.sources.set(track.id, source);
      this._panners.set(track.id, panner);
      this.gains.set(track.id, gain);
    });

    this._duration = maxDuration;

    const remaining = maxDuration - offset;
    if (remaining > 0 && this.onEndCallback) {
      const cb = this.onEndCallback;
      this.endTimeout = setTimeout(() => {
        this.stopPositionTracking();
        this._startContextTime = 0;
        cb();
      }, remaining * 1000 + 100);
    }

    this.startPositionTracking();
  }

  stop() {
    this.stopPositionTracking();
    if (this.endTimeout) {
      clearTimeout(this.endTimeout);
      this.endTimeout = null;
    }
    this._startContextTime = 0;
    this.sources.forEach((source) => {
      try {
        source.stop();
      } catch {
        // Already stopped
      }
    });
    this.sources.clear();
    this._panners.clear();
    this.gains.clear();
  }

  seekTo(tracks: Track[], position: number, onEnd?: () => void) {
    this.play(tracks, onEnd, position);
  }

  /** Set position without playing (for scrubbing) */
  setPosition(position: number) {
    this._startOffset = position;
    this._startContextTime = 0;
  }

  getDuration(tracks: Track[]): number {
    let max = 0;
    tracks.forEach((t) => {
      if (t.audioBuffer && t.audioBuffer.duration > max) {
        max = t.audioBuffer.duration;
      }
    });
    return max;
  }

  setVolume(id: string, vol: number) {
    const ctx = getAudioContext();
    const gain = this.gains.get(id);
    if (gain) {
      gain.gain.setValueAtTime(vol, ctx.currentTime);
    }
  }

  setPan(id: string, pan: number) {
    const panner = this._panners.get(id);
    if (panner) {
      panner.pan.setValueAtTime(
        Math.max(-1, Math.min(1, pan)),
        getAudioContext().currentTime
      );
    }
  }

  setMasterVolume(vol: number) {
    this.getMasterGain().gain.setValueAtTime(
      Math.max(0, Math.min(1.5, vol)),
      getAudioContext().currentTime
    );
  }

  /** Update gain nodes to reflect current mute/solo state */
  updateMuteSolo(tracks: Track[]) {
    const ctx = getAudioContext();
    const hasSolo = tracks.some((t) => t.solo);

    tracks.forEach((track) => {
      const gain = this.gains.get(track.id);
      if (!gain) return;

      let shouldPlay = true;
      if (track.muted) shouldPlay = false;
      if (hasSolo && !track.solo) shouldPlay = false;

      const targetGain = shouldPlay ? track.volume : 0;
      gain.gain.setValueAtTime(targetGain, ctx.currentTime);
    });
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

    const masterGain = offlineCtx.createGain();
    masterGain.gain.value = this._masterGain?.gain.value ?? 0.8;
    masterGain.connect(offlineCtx.destination);

    activeTracks.forEach((track) => {
      const source = offlineCtx.createBufferSource();
      const panner = offlineCtx.createStereoPanner();
      const gain = offlineCtx.createGain();
      source.buffer = track.audioBuffer!;
      panner.pan.value = track.pan ?? 0;
      gain.gain.value = track.volume;
      source.connect(panner).connect(gain).connect(masterGain);
      source.start(0);
    });

    const renderedBuffer = await offlineCtx.startRendering();
    return audioBufferToWavBlob(renderedBuffer);
  }
}

export const mixer = new Mixer();
