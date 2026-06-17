import fs from "node:fs";
import { env } from "../env.js";
import { run } from "./exec.js";

/** Run ffmpeg with the given args. `onProgress` receives 0..1 if parseable. */
export async function ffmpeg(
  args: string[],
  opts: { totalDurationSec?: number; onProgress?: (p: number) => void } = {},
): Promise<void> {
  let onStderr: ((c: string) => void) | undefined;
  if (opts.onProgress && opts.totalDurationSec && opts.totalDurationSec > 0) {
    onStderr = (chunk) => {
      // ffmpeg prints "time=00:00:03.45" lines on stderr
      const m = chunk.match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (m) {
        const secs =
          parseInt(m[1], 10) * 3600 +
          parseInt(m[2], 10) * 60 +
          parseFloat(m[3]);
        const p = Math.min(1, secs / opts.totalDurationSec!);
        opts.onProgress!(p);
      }
    };
  }
  await run(env.FFMPEG_PATH, ["-hide_banner", "-y", ...args], { onStderr });
}

/** Probe a media file's duration in seconds (0 if unknown). */
export async function probeDuration(file: string): Promise<number> {
  if (!fs.existsSync(file)) return 0;
  try {
    const { stdout } = await run(env.FFPROBE_PATH, [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      file,
    ]);
    const d = parseFloat(stdout.trim());
    return Number.isFinite(d) ? d : 0;
  } catch {
    return 0;
  }
}

/**
 * Escape text for a `drawtext` value that we ALWAYS wrap in single quotes,
 * e.g. drawtext=text='<here>'. Inside single quotes the filtergraph parser
 * treats characters literally, so the only things we must neutralize are the
 * single quote itself (would close the string) and newlines.
 */
export function escapeDrawText(text: string): string {
  return text
    .replace(/'/g, "’") // curly apostrophe — can't appear in single-quoted value
    .replace(/[\r\n]+/g, " ")
    .trim();
}
