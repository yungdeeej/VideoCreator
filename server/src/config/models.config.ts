/**
 * Centralized model configuration — the ONE place to update fal.ai model
 * slugs, prices, and defaults. Adding a new video model (e.g. Veo) should be
 * a single entry here, not a code change elsewhere.
 *
 * IMPORTANT: fal renames/versions models frequently. The slugs below were
 * verified against fal.ai model pages at build time (June 2026):
 *   - Nano Banana Pro (text):  fal-ai/nano-banana-pro
 *   - Nano Banana Pro (edit):  fal-ai/nano-banana-pro/edit
 *   - Kling v2.1 Pro (i2v):    fal-ai/kling-video/v2.1/pro/image-to-video
 *   - Seedance 1.5 Pro (i2v):  fal-ai/bytedance/seedance/v1.5/pro/image-to-video
 * Re-verify on the fal model pages before relying on prices for billing.
 */

import type {
  VideoModelInfo,
  VideoModelKey,
  PublicConfig,
} from "@storyforge/shared";

// ---------- Image model (Nano Banana Pro) ----------

export interface ImageModelConfig {
  /** Text-to-image endpoint (used when there is NO character reference). */
  textModelId: string;
  /** Image-edit / reference endpoint (used WITH a character reference). */
  editModelId: string;
  /** Approx price per generated image (USD). Re-verify on fal. */
  pricePerImage: number;
  /**
   * Default output resolution. Keep ~1K — higher res makes pixel art
   * smoother/worse and costs more. fal Nano Banana uses an aspect-ratio /
   * resolution enum rather than width/height.
   */
  defaultResolution: "1K" | "2K" | "4K";
  defaultResolutionLabel: string;
}

export const IMAGE_MODEL: ImageModelConfig = {
  textModelId: "fal-ai/nano-banana-pro",
  editModelId: "fal-ai/nano-banana-pro/edit",
  pricePerImage: 0.139,
  defaultResolution: "1K",
  defaultResolutionLabel: "~1K (pixel-art friendly)",
};

// ---------- Video models (config-driven list) ----------

export interface VideoModelConfig {
  key: VideoModelKey;
  label: string; // user-facing
  falModelId: string;
  type: "image-to-video" | "frames-to-video";
  defaultDurationSec: number;
  pricePerSecond: number; // USD
  /** Logical inputs the orchestrator must satisfy before submitting. */
  requiredInputs: Array<"startImage" | "endImage" | "motionPrompt">;
  /** True when a generated END frame is also required (start->end morph). */
  needsEndFrame: boolean;
  /** fal often only allows specific durations; nearest is chosen. */
  allowedDurations: number[];
}

export const VIDEO_MODELS: Record<VideoModelKey, VideoModelConfig> = {
  kling: {
    key: "kling",
    label: "Kling Pro",
    falModelId: "fal-ai/kling-video/v2.1/pro/image-to-video",
    type: "image-to-video",
    defaultDurationSec: 5,
    pricePerSecond: 0.095,
    requiredInputs: ["startImage", "motionPrompt"],
    needsEndFrame: false,
    allowedDurations: [5, 10],
  },
  seedance: {
    key: "seedance",
    label: "Seedance 1.5 Pro (morph)",
    falModelId: "fal-ai/bytedance/seedance/v1.5/pro/image-to-video",
    type: "frames-to-video",
    defaultDurationSec: 5,
    pricePerSecond: 0.062,
    requiredInputs: ["startImage", "endImage", "motionPrompt"],
    needsEndFrame: true,
    allowedDurations: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  },
};

export function getVideoModel(key: VideoModelKey): VideoModelConfig {
  const m = VIDEO_MODELS[key];
  if (!m) throw new Error(`Unknown video model: ${key}`);
  return m;
}

/** Snap a requested duration to the nearest value the model allows. */
export function snapDuration(key: VideoModelKey, requested: number): number {
  const allowed = getVideoModel(key).allowedDurations;
  return allowed.reduce((best, d) =>
    Math.abs(d - requested) < Math.abs(best - requested) ? d : best,
  );
}

// ---------- Defaults shipped with every new project (Section 8) ----------

export const DEFAULT_STYLE_PRESET = `Pixel art, cozy isometric farming-sim style: chibi proportions, bold black outlines, flat saturated palette, hard pixel edges, NO anti-aliasing, no smoothing. Cinematic lighting, warm golden-hour glow, soft long shadows, atmospheric depth. Polished indie game key art, not AI generated.`;

export const DEFAULT_MOTION_SUFFIX = `Smooth, stable, cinematic motion. Preserve the pixel art style exactly — hard pixel edges, no warping, no melting, no smoothing of edges.`;

// ---------- Public, secret-free view for the frontend ----------

export function toVideoModelInfo(m: VideoModelConfig): VideoModelInfo {
  return {
    key: m.key,
    label: m.label,
    type: m.type,
    defaultDurationSec: m.defaultDurationSec,
    pricePerSecond: m.pricePerSecond,
    requiredInputs: m.requiredInputs,
    needsEndFrame: m.needsEndFrame,
  };
}

export function buildPublicConfig(opts: {
  maxConcurrentJobs: number;
  mockMode: boolean;
  assistAvailable: boolean;
  assistMock: boolean;
}): PublicConfig {
  return {
    videoModels: Object.values(VIDEO_MODELS).map(toVideoModelInfo),
    image: {
      pricePerImage: IMAGE_MODEL.pricePerImage,
      defaultResolutionLabel: IMAGE_MODEL.defaultResolutionLabel,
    },
    aspectRatios: ["16:9", "1:1", "9:16"],
    defaultStylePreset: DEFAULT_STYLE_PRESET,
    defaultMotionSuffix: DEFAULT_MOTION_SUFFIX,
    maxConcurrentJobs: opts.maxConcurrentJobs,
    mockMode: opts.mockMode,
    assistAvailable: opts.assistAvailable,
    assistMock: opts.assistMock,
  };
}
