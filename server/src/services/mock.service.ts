/**
 * Mock generation (FAL_MOCK=1). Synthesizes placeholder stills and clips
 * locally with ffmpeg so the whole storyboard -> generate -> combine -> export
 * pipeline can be exercised without a FAL_KEY. NOT used in real mode.
 */

import { randomUUID } from "node:crypto";
import path from "node:path";
import { env } from "../env.js";
import { ffmpeg, escapeDrawText } from "../util/ffmpeg.js";
import { assetUrl, assetFilePath, fetchToFile } from "../util/assets.js";
import { dimsFor } from "../util/resolution.js";
import type { AspectRatio } from "@storyforge/shared";

const PALETTE = [
  "0x6b4f3a", "0x3a5a6b", "0x4a6b3a", "0x6b3a52",
  "0x3a3f6b", "0x6b633a", "0x3a6b5e", "0x52466b",
];

function colorFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function truncate(s: string, n: number): string {
  const clean = s.replace(/\s+/g, " ").trim();
  return clean.length > n ? clean.slice(0, n - 1) + "…" : clean;
}

function drawText(text: string, w: number, fontsize: number, y: string): string {
  const label = escapeDrawText(text);
  return [
    `drawtext=fontfile='${env.FONT_FILE}'`,
    `text='${label}'`,
    `fontcolor=white`,
    `fontsize=${fontsize}`,
    `x=(w-text_w)/2`,
    `y=${y}`,
    `box=1:boxcolor=black@0.45:boxborderw=18`,
  ].join(":");
}

/** Render a placeholder still and return its served URL. */
export async function mockImage(opts: {
  prompt: string;
  aspect: AspectRatio;
  tag?: string;
}): Promise<string> {
  const { w, h } = dimsFor(opts.aspect);
  const filename = `${randomUUID()}.png`;
  const out = assetFilePath(filename);
  const bg = colorFor(opts.prompt + (opts.tag ?? ""));
  const tagLine = opts.tag ? `[${opts.tag}] ` : "";
  const vf = [
    drawText(`MOCK STILL`, w, Math.round(w / 18), "h*0.18"),
    drawText(truncate(tagLine + opts.prompt, 70), w, Math.round(w / 26), "(h-text_h)/2"),
  ].join(",");

  await ffmpeg([
    "-f", "lavfi",
    "-i", `color=c=${bg}:s=${w}x${h}`,
    "-vf", vf,
    "-frames:v", "1",
    out,
  ]);
  return assetUrl(filename);
}

/**
 * Render a placeholder clip from a start image (looped for the duration with
 * a slow zoom so there's visible "motion"). Returns its served URL.
 */
export async function mockVideo(opts: {
  startImageUrl: string;
  endImageUrl?: string;
  aspect: AspectRatio;
  durationSec: number;
  label: string;
}): Promise<string> {
  const { w, h } = dimsFor(opts.aspect);
  const dur = Math.max(1, Math.round(opts.durationSec));
  const fps = 30;
  const tmpStart = path.join(env.paths.tmpDir, `${randomUUID()}.png`);
  await fetchToFile(opts.startImageUrl, tmpStart);

  const filename = `${randomUUID()}.mp4`;
  const out = assetFilePath(filename);
  const totalFrames = dur * fps;

  // scale -> slow zoompan -> label, then encode H.264 yuv420p.
  const vf = [
    `scale=${w * 2}:${h * 2}`,
    `zoompan=z='min(zoom+0.0008,1.15)':d=${totalFrames}:s=${w}x${h}:fps=${fps}`,
    drawText(`MOCK ▸ ${opts.label}`, w, Math.round(w / 28), "h-(text_h*2)"),
    "format=yuv420p",
  ].join(",");

  await ffmpeg([
    "-loop", "1",
    "-i", tmpStart,
    "-t", String(dur),
    "-vf", vf,
    "-r", String(fps),
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    out,
  ]);
  return assetUrl(filename);
}
