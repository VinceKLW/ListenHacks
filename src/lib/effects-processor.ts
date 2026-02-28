import * as Tone from "tone";
import type { Track } from "@/types/music";
import { DEFAULT_EFFECTS } from "@/types/effects";

type ToneNode = Tone.ToneAudioNode;

/** Connect source through effect chain to destination. Returns cleanup fn. */
export function connectWithEffects(
  source: AudioNode,
  track: Track,
  destination: AudioNode,
  context: AudioContext | OfflineAudioContext
): () => void {
  const effects = { ...DEFAULT_EFFECTS, ...track.effects };
  let currentNode: AudioNode = source;
  const toDispose: { dispose?: () => void }[] = [];

  // Ensure Tone uses the correct context (for playback/export)
  Tone.setContext(context as unknown as AudioContext);

  const chain = (node: ToneNode) => {
    currentNode.connect(node as unknown as AudioNode);
    currentNode = node as unknown as AudioNode;
    toDispose.push(node);
  };

  if (effects.reverb?.enabled) {
    // Use Tone.Reverb - generate() is async; start it immediately so it may be ready by first play
    const r = new Tone.Reverb({
      decay: effects.reverb.decay,
      wet: effects.reverb.wet,
    });
    r.generate().catch(() => {});
    chain(r);
  }
  if (effects.delay?.enabled) {
    const d = new Tone.FeedbackDelay({
      delayTime: effects.delay.time,
      feedback: effects.delay.feedback,
      wet: effects.delay.wet,
    });
    chain(d);
  }
  if (effects.filter?.enabled) {
    const f = new Tone.Filter({
      type: effects.filter.type,
      frequency: effects.filter.frequency,
      Q: effects.filter.Q,
    });
    chain(f);
  }
  if (effects.distortion?.enabled) {
    const d = new Tone.Distortion(effects.distortion.amount);
    chain(d);
  }
  if (effects.compressor?.enabled) {
    const c = new Tone.Compressor({
      threshold: effects.compressor.threshold,
      ratio: effects.compressor.ratio,
      knee: effects.compressor.knee,
    });
    chain(c);
  }

  currentNode.connect(destination);

  return () => {
    source.disconnect();
    currentNode.disconnect();
    toDispose.forEach((n) => n.dispose?.());
  };
}
