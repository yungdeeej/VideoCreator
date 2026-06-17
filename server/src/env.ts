import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// server/src -> server
const serverRoot = path.resolve(__dirname, "..");
// server -> repo root
const repoRoot = path.resolve(serverRoot, "..");

function resolveDataDir(): string {
  const raw = process.env.DATA_DIR?.trim();
  if (raw) return path.isAbsolute(raw) ? raw : path.resolve(repoRoot, raw);
  return path.join(serverRoot, "data");
}

const DATA_DIR = resolveDataDir();
const ASSETS_DIR = path.join(DATA_DIR, "assets");
const EXPORTS_DIR = path.join(DATA_DIR, "exports");
const TMP_DIR = path.join(DATA_DIR, "tmp");

for (const dir of [DATA_DIR, ASSETS_DIR, EXPORTS_DIR, TMP_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

function int(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

export const env = {
  PORT: int("PORT", 8787),
  FAL_KEY: process.env.FAL_KEY?.trim() || "",
  FAL_MOCK: process.env.FAL_MOCK === "1" || process.env.FAL_MOCK === "true",
  FFMPEG_PATH: process.env.FFMPEG_PATH?.trim() || "ffmpeg",
  FFPROBE_PATH: process.env.FFPROBE_PATH?.trim() || "ffprobe",
  FONT_FILE:
    process.env.FONT_FILE?.trim() ||
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  MAX_CONCURRENT_JOBS: int("MAX_CONCURRENT_JOBS", 8),
  PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL?.trim() || "",

  paths: {
    repoRoot,
    serverRoot,
    dataDir: DATA_DIR,
    assetsDir: ASSETS_DIR,
    exportsDir: EXPORTS_DIR,
    tmpDir: TMP_DIR,
    clientDist: path.join(repoRoot, "client", "dist"),
  },
} as const;

export const hasFal = () => env.FAL_MOCK || !!env.FAL_KEY;
