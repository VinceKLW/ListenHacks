export type DrumType =
  | "kick"
  | "snare"
  | "closedhat"
  | "openhat"
  | "clap"
  | "lowTom"
  | "midTom"
  | "rim";

// ─── helpers ─────────────────────────────────────────────────────────────────

function noise(ctx: BaseAudioContext, duration: number): AudioBuffer {
  const len = Math.ceil(ctx.sampleRate * duration);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

// ─── individual drum voices ───────────────────────────────────────────────────

function synthKick(ctx: BaseAudioContext, dest: AudioNode, t: number) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(200, t);
  osc.frequency.exponentialRampToValueAtTime(0.001, t + 0.55);
  g.gain.setValueAtTime(2.0, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
  osc.connect(g).connect(dest);
  osc.start(t);
  osc.stop(t + 0.6);
}

function synthSnare(ctx: BaseAudioContext, dest: AudioNode, t: number) {
  // noise burst
  const ns = ctx.createBufferSource();
  ns.buffer = noise(ctx, 0.25);
  const nf = ctx.createBiquadFilter();
  nf.type = "bandpass";
  nf.frequency.value = 3000;
  nf.Q.value = 0.6;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(1.2, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  ns.connect(nf).connect(ng).connect(dest);
  ns.start(t);

  // body tone
  const osc = ctx.createOscillator();
  const og = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(260, t);
  osc.frequency.exponentialRampToValueAtTime(160, t + 0.1);
  og.gain.setValueAtTime(0.7, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  osc.connect(og).connect(dest);
  osc.start(t);
  osc.stop(t + 0.25);
}

function synthClosedHat(ctx: BaseAudioContext, dest: AudioNode, t: number) {
  const ns = ctx.createBufferSource();
  ns.buffer = noise(ctx, 0.1);
  const f = ctx.createBiquadFilter();
  f.type = "highpass";
  f.frequency.value = 8000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.8, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
  ns.connect(f).connect(g).connect(dest);
  ns.start(t);
}

function synthOpenHat(ctx: BaseAudioContext, dest: AudioNode, t: number) {
  const ns = ctx.createBufferSource();
  ns.buffer = noise(ctx, 0.5);
  const f = ctx.createBiquadFilter();
  f.type = "highpass";
  f.frequency.value = 6000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.55, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
  ns.connect(f).connect(g).connect(dest);
  ns.start(t);
}

function synthClap(ctx: BaseAudioContext, dest: AudioNode, t: number) {
  [0, 0.012, 0.024, 0.04].forEach((off, i) => {
    const ns = ctx.createBufferSource();
    ns.buffer = noise(ctx, 0.12);
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 1300;
    f.Q.value = 0.9;
    const g = ctx.createGain();
    const decay = i === 3 ? 0.22 : 0.04;
    g.gain.setValueAtTime(i === 3 ? 1.0 : 0.55, t + off);
    g.gain.exponentialRampToValueAtTime(0.001, t + off + decay);
    ns.connect(f).connect(g).connect(dest);
    ns.start(t + off);
  });
}

function synthTom(
  ctx: BaseAudioContext,
  dest: AudioNode,
  t: number,
  startHz: number,
  endHz: number
) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(startHz, t);
  osc.frequency.exponentialRampToValueAtTime(endHz, t + 0.3);
  g.gain.setValueAtTime(1.0, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
  osc.connect(g).connect(dest);
  osc.start(t);
  osc.stop(t + 0.4);
}

function synthRim(ctx: BaseAudioContext, dest: AudioNode, t: number) {
  const osc = ctx.createOscillator();
  const og = ctx.createGain();
  osc.type = "square";
  osc.frequency.value = 1000;
  og.gain.setValueAtTime(0.7, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
  osc.connect(og).connect(dest);
  osc.start(t);
  osc.stop(t + 0.06);

  const ns = ctx.createBufferSource();
  ns.buffer = noise(ctx, 0.06);
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.35, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
  ns.connect(ng).connect(dest);
  ns.start(t);
}

// ─── public API ──────────────────────────────────────────────────────────────

/** Play a drum sound immediately using the live AudioContext. */
export function playDrum(type: DrumType, time?: number) {
  // Dynamic import to avoid SSR issues with AudioContext
  if (typeof window === "undefined") return;
  const { getAudioContext } = require("./audio-utils") as {
    getAudioContext: () => AudioContext;
  };
  const ctx = getAudioContext();
  const t = time ?? ctx.currentTime;
  playDrumInContext(type, ctx, ctx.destination, t);
}

/** Play a drum sound into a given context/destination (supports OfflineAudioContext). */
export function playDrumInContext(
  type: DrumType,
  ctx: BaseAudioContext,
  dest: AudioNode,
  t: number
) {
  switch (type) {
    case "kick":
      synthKick(ctx, dest, t);
      break;
    case "snare":
      synthSnare(ctx, dest, t);
      break;
    case "closedhat":
      synthClosedHat(ctx, dest, t);
      break;
    case "openhat":
      synthOpenHat(ctx, dest, t);
      break;
    case "clap":
      synthClap(ctx, dest, t);
      break;
    case "lowTom":
      synthTom(ctx, dest, t, 100, 50);
      break;
    case "midTom":
      synthTom(ctx, dest, t, 145, 75);
      break;
    case "rim":
      synthRim(ctx, dest, t);
      break;
  }
}

/**
 * Render `bars` repetitions of `pattern` into a WAV-ready AudioBuffer.
 * @param pattern  boolean[numDrums][16]
 * @param drums    ordered drum types matching pattern rows
 * @param bpm      beats per minute
 * @param bars     how many times to repeat the pattern (default 4)
 */
export async function renderPatternToBuffer(
  pattern: boolean[][],
  drums: DrumType[],
  bpm: number,
  bars = 4
): Promise<AudioBuffer> {
  const sampleRate = 44100;
  const spStep = 60 / bpm / 4; // seconds per 16th note
  const duration = spStep * 16 * bars + 1.0; // +1s tail for last hit decay

  const offCtx = new OfflineAudioContext(
    2,
    Math.ceil(duration * sampleRate),
    sampleRate
  );

  // Add a soft limiter to prevent clipping when many drums hit at once
  const limiter = offCtx.createDynamicsCompressor();
  limiter.threshold.value = -3;
  limiter.knee.value = 3;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.1;
  limiter.connect(offCtx.destination);

  for (let bar = 0; bar < bars; bar++) {
    for (let step = 0; step < 16; step++) {
      const t = (bar * 16 + step) * spStep;
      pattern.forEach((row, di) => {
        if (row[step]) playDrumInContext(drums[di], offCtx, limiter, t);
      });
    }
  }

  return offCtx.startRendering();
}
