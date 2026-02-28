/** Per-track audio effects configuration */

export interface ReverbEffect {
  enabled: boolean;
  decay: number; // 0.5 - 10 sec
  wet: number; // 0 - 1
}

export interface DelayEffect {
  enabled: boolean;
  time: number; // 0.1 - 2 sec
  feedback: number; // 0 - 0.95
  wet: number; // 0 - 1
}

export interface FilterEffect {
  enabled: boolean;
  type: "lowpass" | "highpass" | "bandpass";
  frequency: number; // 20 - 20000 Hz
  Q: number; // 0.1 - 10
}

export interface DistortionEffect {
  enabled: boolean;
  amount: number; // 0 - 1
}

export interface CompressorEffect {
  enabled: boolean;
  threshold: number; // -60 to 0 dB
  ratio: number; // 1 - 20
  knee: number; // 0 - 40
}

export interface TrackEffects {
  reverb?: ReverbEffect;
  delay?: DelayEffect;
  filter?: FilterEffect;
  distortion?: DistortionEffect;
  compressor?: CompressorEffect;
}

export const DEFAULT_EFFECTS: TrackEffects = {
  reverb: { enabled: false, decay: 2.5, wet: 0.3 },
  delay: { enabled: false, time: 0.25, feedback: 0.4, wet: 0.25 },
  filter: { enabled: false, type: "lowpass", frequency: 4000, Q: 1 },
  distortion: { enabled: false, amount: 0.3 },
  compressor: { enabled: false, threshold: -20, ratio: 4, knee: 6 },
};
