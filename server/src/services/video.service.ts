/**
 * Video generation via fal. Config-driven over models.config.ts:
 *   - Kling Pro      image -> video (workhorse)
 *   - Seedance 1.5   start-frame + end-frame -> video (morph/transformation)
 */

import { env } from "../env.js";
import { getVideoModel, snapDuration } from "../config/models.config.js";
import { runFalJob } from "./fal.service.js";
import { mockVideo } from "./mock.service.js";
import type { AspectRatio, VideoModelKey } from "@storyforge/shared";

/** Append the project's motion suffix (pixel-art preservation) to the prompt. */
export function assembleMotionPrompt(
  motionPrompt: string,
  motionSuffix: string,
): string {
  const base = motionPrompt.trim();
  const suffix = motionSuffix.trim();
  if (!suffix) return base;
  return base ? `${base}\n\n${suffix}` : suffix;
}

export interface GenerateVideoOpts {
  model: VideoModelKey;
  /** Fully-assembled motion prompt (motion prompt + suffix). */
  motionPrompt: string;
  startImageUrl: string;
  /** Required for Seedance morph scenes. */
  endImageUrl?: string;
  durationSec: number;
  aspect: AspectRatio; // mock mode only
  onStatus?: (status: string) => void;
}

interface VideoResult {
  video?: { url: string };
}

export async function generateVideo(opts: GenerateVideoOpts): Promise<string> {
  const cfg = getVideoModel(opts.model);

  if (cfg.needsEndFrame && !opts.endImageUrl) {
    throw new Error(`${cfg.label} requires both a start and an end image`);
  }

  if (env.FAL_MOCK) {
    return mockVideo({
      startImageUrl: opts.startImageUrl,
      endImageUrl: opts.endImageUrl,
      aspect: opts.aspect,
      durationSec: opts.durationSec,
      label: cfg.label,
    });
  }

  const duration = snapDuration(opts.model, opts.durationSec);

  const input: Record<string, unknown> = {
    prompt: opts.motionPrompt,
    image_url: opts.startImageUrl,
    duration: String(duration),
  };
  if (opts.model === "seedance") {
    // Seedance 1.5 Pro uses the end frame to define where the shot lands.
    input.end_image_url = opts.endImageUrl;
  }

  const data = await runFalJob<VideoResult>({
    modelId: cfg.falModelId,
    input,
    onStatus: opts.onStatus,
  });

  const url = data?.video?.url;
  if (!url) {
    throw new Error("Video generation returned no video URL");
  }
  return url;
}
