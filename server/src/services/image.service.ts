/**
 * Image generation via Nano Banana Pro (fal). Two modes:
 *   - text->image          when there is no character reference
 *   - image-edit/reference when a character ref is set (keeps the character
 *                          consistent across scenes)
 */

import { env } from "../env.js";
import { IMAGE_MODEL } from "../config/models.config.js";
import { runFalJob } from "./fal.service.js";
import { mockImage } from "./mock.service.js";
import type { AspectRatio } from "@storyforge/shared";

/** Assemble the final prompt sent to the model (only the scene part is stored). */
export function assembleImagePrompt(
  stylePreset: string,
  scenePrompt: string,
): string {
  const style = stylePreset.trim();
  const scene = scenePrompt.trim();
  return style ? `${style}\n\n${scene}` : scene;
}

export interface GenerateImageOpts {
  /** Fully-assembled prompt (style preset + scene prompt). */
  prompt: string;
  aspect: AspectRatio;
  /** When set, uses the reference/edit endpoint for character consistency. */
  referenceImageUrl?: string;
  /** Label used only by mock mode ("start" / "end"). */
  tag?: string;
  onStatus?: (status: string) => void;
}

interface NanoBananaResult {
  images?: Array<{ url: string }>;
}

export async function generateImage(opts: GenerateImageOpts): Promise<string> {
  if (env.FAL_MOCK) {
    return mockImage({ prompt: opts.prompt, aspect: opts.aspect, tag: opts.tag });
  }

  const useEdit = !!opts.referenceImageUrl;
  const modelId = useEdit ? IMAGE_MODEL.editModelId : IMAGE_MODEL.textModelId;

  const input: Record<string, unknown> = {
    prompt: opts.prompt,
    aspect_ratio: opts.aspect,
    resolution: IMAGE_MODEL.defaultResolution,
    num_images: 1,
  };
  if (useEdit) {
    // The edit/reference endpoint takes the character ref as an input image.
    input.image_urls = [opts.referenceImageUrl];
  }

  const data = await runFalJob<NanoBananaResult>({
    modelId,
    input,
    onStatus: opts.onStatus,
  });

  const url = data?.images?.[0]?.url;
  if (!url) {
    throw new Error("Image generation returned no image URL");
  }
  return url;
}
