/**
 * Claude-powered prompt assistant. Turns rough ideas / loglines into polished
 * prompts for the image (Nano Banana Pro) and video (Kling / Seedance) models.
 *
 * Uses the official @anthropic-ai/sdk with structured outputs (messages.parse +
 * zodOutputFormat) so responses are always valid JSON. Model defaults to
 * claude-opus-4-8. When CLAUDE_MOCK=1 (and no key) it returns deterministic
 * templated suggestions so the feature can be exercised without an API key.
 */

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { env } from "../env.js";
import type {
  AspectRatio,
  DraftStoryboardResult,
  SceneSuggestion,
  VideoModelKey,
} from "@storyforge/shared";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Set it in the backend env, or use CLAUDE_MOCK=1 for templated suggestions.",
    );
  }
  if (!client) client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return client;
}

const SYSTEM = `You are a prompt engineer for an AI story-video pipeline that uses Nano Banana Pro (text->image) and Kling / Seedance (image->video) models, specializing in cozy isometric pixel-art game lore.

Rules:
- The project's STYLE PRESET is automatically prepended to every image prompt. NEVER repeat style/medium words (pixel art, isometric, palette, lighting, "not AI") in your image prompts — describe only the SCENE: subject, composition, action, time of day, mood.
- Image prompts: one vivid, concrete sentence. Frame it as a single still.
- Motion prompts: describe camera movement and subject motion suited to image-to-video (e.g. "slow push-in as smoke drifts from the chimney"). One sentence. Keep motion gentle and stable — no rapid cuts.
- For Seedance morph scenes, the start frame and the end frame are two stills of the same place/subject in different states; write an endImagePrompt describing the transformed END state. For non-morph (Kling) scenes, leave endImagePrompt as an empty string.
- Keep everything concise and shoot-ready. No preamble, no commentary.`;

const SceneSchema = z.object({
  imagePrompt: z
    .string()
    .describe("One vivid sentence describing the still: subject, composition, action, time of day, mood. No style/medium words."),
  motionPrompt: z
    .string()
    .describe("One sentence: camera movement + subject motion for image-to-video. Gentle and stable."),
  endImagePrompt: z
    .string()
    .describe("For Seedance morph scenes only: the transformed END state. Empty string for normal (Kling) scenes."),
});

const StoryboardSchema = z.object({
  suggestedTitle: z.string().describe("A short evocative title for the whole sequence."),
  scenes: z
    .array(
      z.object({
        imagePrompt: z.string().describe("One vivid scene sentence. No style/medium words."),
        motionPrompt: z.string().describe("One sentence of gentle camera + subject motion."),
      }),
    )
    .describe("Ordered scenes that tell the story beat by beat."),
});

// ---------- public API ----------

export function suggestScene(opts: {
  idea: string;
  videoModel: VideoModelKey;
  aspectRatio: AspectRatio;
  stylePreset?: string;
}): Promise<SceneSuggestion> {
  if (env.CLAUDE_MOCK && !env.ANTHROPIC_API_KEY) {
    return Promise.resolve(mockScene(opts.idea, opts.videoModel));
  }
  return realSuggestScene(opts);
}

export function draftStoryboard(opts: {
  logline: string;
  sceneCount: number;
  aspectRatio: AspectRatio;
  stylePreset?: string;
}): Promise<DraftStoryboardResult> {
  const n = Math.max(1, Math.min(12, Math.round(opts.sceneCount)));
  if (env.CLAUDE_MOCK && !env.ANTHROPIC_API_KEY) {
    return Promise.resolve(mockStoryboard(opts.logline, n));
  }
  return realDraftStoryboard({ ...opts, sceneCount: n });
}

// ---------- real Claude calls ----------

async function realSuggestScene(opts: {
  idea: string;
  videoModel: VideoModelKey;
  aspectRatio: AspectRatio;
  stylePreset?: string;
}): Promise<SceneSuggestion> {
  const isMorph = opts.videoModel === "seedance";
  const userText = [
    `Scene idea: ${opts.idea}`,
    `Video model: ${opts.videoModel}${isMorph ? " (start->end morph — write an endImagePrompt for the transformed state)" : " (single image -> video — endImagePrompt must be an empty string)"}`,
    `Aspect ratio: ${opts.aspectRatio}`,
    opts.stylePreset ? `Style preset (already applied, do NOT repeat): ${opts.stylePreset}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const msg = await getClient().messages.parse({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 2048,
    thinking: { type: "disabled" },
    output_config: { format: zodOutputFormat(SceneSchema), effort: "low" },
    system: SYSTEM,
    messages: [{ role: "user", content: userText }],
  });

  const out = msg.parsed_output;
  if (!out) throw new Error("Claude returned no parseable suggestion");
  return {
    imagePrompt: out.imagePrompt,
    motionPrompt: out.motionPrompt,
    endImagePrompt: isMorph ? out.endImagePrompt : "",
  };
}

async function realDraftStoryboard(opts: {
  logline: string;
  sceneCount: number;
  aspectRatio: AspectRatio;
  stylePreset?: string;
}): Promise<DraftStoryboardResult> {
  const userText = [
    `Logline: ${opts.logline}`,
    `Write exactly ${opts.sceneCount} scenes that tell this story beat by beat, in order.`,
    `Aspect ratio: ${opts.aspectRatio}`,
    opts.stylePreset ? `Style preset (already applied, do NOT repeat): ${opts.stylePreset}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const msg = await getClient().messages.parse({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 8192,
    thinking: { type: "adaptive" },
    output_config: { format: zodOutputFormat(StoryboardSchema), effort: "medium" },
    system: SYSTEM,
    messages: [{ role: "user", content: userText }],
  });

  const out = msg.parsed_output;
  if (!out) throw new Error("Claude returned no parseable storyboard");
  return {
    suggestedTitle: out.suggestedTitle,
    scenes: out.scenes.slice(0, opts.sceneCount).map((s) => ({
      imagePrompt: s.imagePrompt,
      motionPrompt: s.motionPrompt,
    })),
  };
}

// ---------- mock (CLAUDE_MOCK) ----------

function mockScene(idea: string, model: VideoModelKey): SceneSuggestion {
  const subject = idea.trim() || "a quiet farmstead at dawn";
  return {
    imagePrompt: `${capitalize(subject)}, centered composition with warm morning light and gentle depth.`,
    motionPrompt: `Slow push-in with subtle ambient motion across ${subject}.`,
    endImagePrompt:
      model === "seedance"
        ? `${capitalize(subject)}, now fully transformed and restored, brighter and lively.`
        : "",
  };
}

function mockStoryboard(logline: string, n: number): DraftStoryboardResult {
  const base = logline.trim() || "a small farm comes back to life";
  const beats = [
    "Establishing wide shot setting the scene",
    "The inciting moment that sets things in motion",
    "Rising action as the work begins",
    "A turning point full of effort and hope",
    "The transformation taking shape",
    "The triumphant reveal",
    "A quiet, warm closing beat",
  ];
  const scenes = Array.from({ length: n }, (_, i) => ({
    imagePrompt: `${capitalize(beats[i % beats.length])} for "${base}".`,
    motionPrompt: `Gentle camera move with soft ambient motion (beat ${i + 1}).`,
  }));
  return { suggestedTitle: `The Story of ${capitalize(base)}`, scenes };
}

function capitalize(s: string): string {
  const t = s.trim();
  return t ? t[0].toUpperCase() + t.slice(1) : t;
}
