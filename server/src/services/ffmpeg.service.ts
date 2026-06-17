/**
 * Video assembly with ffmpeg. The golden rule (Section 5.4): NORMALIZE every
 * clip to identical codec/resolution/fps/pixel-format/SAR before concatenating
 * — mismatched inputs are the #1 cause of corrupt/janky output. We then concat
 * the normalized parts with the concat demuxer.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "../env.js";
import { ffmpeg, escapeDrawText } from "../util/ffmpeg.js";
import { dimsFor, type Dims } from "../util/resolution.js";
import { fetchToFile, exportUrl } from "../util/assets.js";
import {
  isScene,
  isTitleCard,
  type Project,
  type TextOverlay,
  type TitleCard,
} from "@storyforge/shared";

const FPS = 30;
const TIMESCALE = "30000";

/** "#0a0b0f" -> "0x0a0b0f"; pass through named colors. */
function toFfmpegColor(c: string): string {
  const m = c.trim().match(/^#([0-9a-fA-F]{6})$/);
  return m ? `0x${m[1]}` : c.trim();
}

/** drawtext filter string. Option values that may contain commas are single-quoted. */
function drawText(opts: {
  text: string;
  fontSize: number;
  color: string;
  x: string;
  y: string;
  enable?: string;
  box?: boolean;
}): string {
  const parts = [
    `drawtext=fontfile='${env.FONT_FILE}'`,
    `text='${escapeDrawText(opts.text)}'`,
    `fontcolor=${toFfmpegColor(opts.color)}`,
    `fontsize=${Math.round(opts.fontSize)}`,
    `x=${opts.x}`,
    `y=${opts.y}`,
  ];
  if (opts.box !== false) {
    parts.push(`box=1`, `boxcolor=black@0.45`, `boxborderw=16`);
  }
  if (opts.enable) parts.push(`enable='${opts.enable}'`);
  return parts.join(":");
}

const MARGIN = "0.06";

/** Map an overlay position to drawtext x/y expressions. */
function overlayXY(pos: TextOverlay["position"]): { x: string; y: string } {
  const left = `w*${MARGIN}`;
  const right = `w-text_w-w*${MARGIN}`;
  const center = `(w-text_w)/2`;
  const top = `h*${MARGIN}`;
  const middle = `(h-text_h)/2`;
  const bottom = `h-text_h-h*${MARGIN}`;
  switch (pos) {
    case "top": return { x: center, y: top };
    case "center": return { x: center, y: middle };
    case "bottom": return { x: center, y: bottom };
    case "top-left": return { x: left, y: top };
    case "top-right": return { x: right, y: top };
    case "bottom-left": return { x: left, y: bottom };
    case "bottom-right": return { x: right, y: bottom };
    default: return { x: center, y: bottom };
  }
}

function overlayFilter(o: TextOverlay): string | null {
  if (!o.text.trim()) return null;
  const { x, y } = overlayXY(o.position);
  const enable =
    o.endSec > o.startSec ? `between(t,${o.startSec},${o.endSec})` : undefined;
  return drawText({ text: o.text, fontSize: o.fontSize, color: o.color, x, y, enable });
}

/** Normalize a source clip to the canonical format, burning in an overlay. */
async function normalizeClip(
  src: string,
  out: string,
  dims: Dims,
  overlay?: TextOverlay,
): Promise<void> {
  const filters = [
    `scale=${dims.w}:${dims.h}:force_original_aspect_ratio=decrease`,
    `pad=${dims.w}:${dims.h}:(ow-iw)/2:(oh-ih)/2`,
    `setsar=1`,
    `fps=${FPS}`,
  ];
  if (overlay) {
    const f = overlayFilter(overlay);
    if (f) filters.push(f);
  }
  filters.push("format=yuv420p");

  await ffmpeg([
    "-i", src,
    "-vf", filters.join(","),
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-profile:v", "high",
    "-r", String(FPS),
    "-video_track_timescale", TIMESCALE,
    "-an", // v1 is video-only; uniform (no) audio keeps concat clean
    out,
  ]);
}

/** Render a title card as a solid-color clip with centered text. */
async function renderTitleCard(
  card: TitleCard,
  out: string,
  dims: Dims,
): Promise<void> {
  const dur = Math.max(1, card.durationSec);
  const filters: string[] = [];
  filters.push(
    drawText({
      text: card.text || " ",
      fontSize: Math.round(dims.w / 18),
      color: card.textColor,
      x: "(w-text_w)/2",
      y: card.subtitle ? "(h-text_h)/2 - h*0.05" : "(h-text_h)/2",
      box: false,
    }),
  );
  if (card.subtitle?.trim()) {
    filters.push(
      drawText({
        text: card.subtitle,
        fontSize: Math.round(dims.w / 36),
        color: card.textColor,
        x: "(w-text_w)/2",
        y: "(h-text_h)/2 + h*0.06",
        box: false,
      }),
    );
  }
  filters.push("format=yuv420p");

  await ffmpeg([
    "-f", "lavfi",
    "-i", `color=c=${toFfmpegColor(card.bgColor)}:s=${dims.w}x${dims.h}:r=${FPS}:d=${dur}`,
    "-vf", filters.join(","),
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-profile:v", "high",
    "-r", String(FPS),
    "-video_track_timescale", TIMESCALE,
    "-an",
    "-t", String(dur),
    out,
  ]);
}

export interface CombineResult {
  url: string;
  filePath: string;
  parts: number;
}

/**
 * Build the final MP4: normalize each scene clip (with its overlay) and render
 * each title card, then concat in timeline order via the concat demuxer.
 */
export async function combineProject(
  project: Project,
  onProgress?: (p: number) => void,
): Promise<CombineResult> {
  const dims = dimsFor(project.aspectRatio);
  const items = [...project.items].sort((a, b) => a.order - b.order);
  const workDir = path.join(env.paths.tmpDir, `export-${project.id}-${randomUUID()}`);
  await fs.mkdir(workDir, { recursive: true });

  const parts: string[] = [];
  let totalDur = 0;
  try {
    let idx = 0;
    for (const item of items) {
      const out = path.join(workDir, `part-${String(idx).padStart(3, "0")}.mp4`);
      if (isScene(item)) {
        if (!item.videoUrl) continue; // not generated yet — skip
        const src = path.join(workDir, `src-${idx}.mp4`);
        await fetchToFile(item.videoUrl, src);
        await normalizeClip(src, out, dims, item.textOverlay);
        parts.push(out);
        totalDur += item.durationSec;
        idx++;
      } else if (isTitleCard(item)) {
        await renderTitleCard(item, out, dims);
        parts.push(out);
        totalDur += item.durationSec;
        idx++;
      }
    }

    if (parts.length === 0) {
      throw new Error("Nothing to export — generate at least one clip first.");
    }

    // concat demuxer file list (absolute paths, single-quoted)
    const listFile = path.join(workDir, "concat.txt");
    await fs.writeFile(
      listFile,
      parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"),
      "utf8",
    );

    const outName = `${project.id}-${Date.now()}.mp4`;
    const outPath = path.join(env.paths.exportsDir, outName);

    await ffmpeg(
      [
        "-f", "concat",
        "-safe", "0",
        "-i", listFile,
        "-c", "copy",
        "-movflags", "+faststart",
        outPath,
      ],
      { totalDurationSec: totalDur, onProgress },
    );

    return { url: exportUrl(outName), filePath: outPath, parts: parts.length };
  } finally {
    // best-effort cleanup of the scratch dir
    fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
