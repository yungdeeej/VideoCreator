import { Router } from "express";
import { asyncRoute } from "../util/route.js";
import { hasClaude } from "../env.js";
import { suggestScene, draftStoryboard } from "../services/claude.service.js";
import type { AspectRatio, VideoModelKey } from "@storyforge/shared";

export const assistRouter = Router();

function ensureAvailable(res: import("express").Response): boolean {
  if (!hasClaude()) {
    res.status(503).json({
      error:
        "Prompt assistant is not configured. Set ANTHROPIC_API_KEY (or CLAUDE_MOCK=1) on the backend.",
    });
    return false;
  }
  return true;
}

/** Expand a rough idea into a polished image + motion prompt for one scene. */
assistRouter.post(
  "/scene",
  asyncRoute(async (req, res) => {
    if (!ensureAvailable(res)) return;
    const { idea, videoModel = "kling", aspectRatio = "16:9", stylePreset } =
      req.body ?? {};
    if (!idea || typeof idea !== "string" || !idea.trim()) {
      res.status(400).json({ error: "idea (non-empty string) is required" });
      return;
    }
    const suggestion = await suggestScene({
      idea,
      videoModel: videoModel as VideoModelKey,
      aspectRatio: aspectRatio as AspectRatio,
      stylePreset,
    });
    res.json(suggestion);
  }),
);

/** Turn a one-line logline into an ordered set of scene prompts. */
assistRouter.post(
  "/storyboard",
  asyncRoute(async (req, res) => {
    if (!ensureAvailable(res)) return;
    const { logline, sceneCount = 5, aspectRatio = "16:9", stylePreset } =
      req.body ?? {};
    if (!logline || typeof logline !== "string" || !logline.trim()) {
      res.status(400).json({ error: "logline (non-empty string) is required" });
      return;
    }
    const result = await draftStoryboard({
      logline,
      sceneCount: Number(sceneCount) || 5,
      aspectRatio: aspectRatio as AspectRatio,
      stylePreset,
    });
    res.json(result);
  }),
);
