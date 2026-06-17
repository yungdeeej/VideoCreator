import { Router } from "express";
import multer from "multer";
import { env } from "../env.js";
import { uploadToFalStorage } from "../services/fal.service.js";
import { saveAssetBuffer } from "../util/assets.js";
import {
  assembleImagePrompt,
  generateImage,
} from "../services/image.service.js";
import { DEFAULT_STYLE_PRESET } from "../config/models.config.js";
import type { AspectRatio } from "@storyforge/shared";

export const assetsRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});

/**
 * Upload a character reference image. In real mode it's pushed to fal storage
 * (so the edit endpoint can fetch it); in mock mode it's saved locally.
 * Returns the URL to store as `project.characterRefImageUrl`.
 */
assetsRouter.post(
  "/upload/reference",
  upload.single("file"),
  async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

      if (env.FAL_MOCK) {
        const ext = (file.mimetype.split("/")[1] || "png").replace("jpeg", "jpg");
        const saved = await saveAssetBuffer(file.buffer, ext);
        res.json({ url: saved.url });
        return;
      }

      const url = await uploadToFalStorage(file.buffer, file.mimetype);
      res.json({ url });
    } catch (err: any) {
      res.status(500).json({ error: err?.message ?? String(err) });
    }
  },
);

/**
 * Dev helper (Phase 2): generate a single image from a prompt + style preset.
 * Lets you test image generation from a simple form before the full
 * storyboard flow exists.
 */
assetsRouter.post("/dev/generate-image", async (req, res) => {
  try {
    const {
      imagePrompt,
      stylePreset = DEFAULT_STYLE_PRESET,
      aspectRatio = "16:9",
      referenceImageUrl,
    } = req.body ?? {};

    if (!imagePrompt || typeof imagePrompt !== "string") {
      res.status(400).json({ error: "imagePrompt (string) is required" });
      return;
    }

    const prompt = assembleImagePrompt(stylePreset, imagePrompt);
    const url = await generateImage({
      prompt,
      aspect: aspectRatio as AspectRatio,
      referenceImageUrl,
    });
    res.json({ url, assembledPrompt: prompt });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});
