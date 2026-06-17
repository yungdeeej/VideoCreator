import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { randomUUID } from "node:crypto";
import { env } from "../env.js";

/** Public URL for a file stored in the assets dir. Relative so the SPA proxy works. */
export function assetUrl(filename: string): string {
  return `/assets/${filename}`;
}

export function exportUrl(filename: string): string {
  return `/exports/${filename}`;
}

/** If a URL points at our own local assets/exports, return its filesystem path. */
function localPathForUrl(url: string): string | null {
  const stripBase = (u: string) => {
    if (env.PUBLIC_BASE_URL && u.startsWith(env.PUBLIC_BASE_URL)) {
      return u.slice(env.PUBLIC_BASE_URL.length);
    }
    // strip any http://host[:port] prefix
    const m = u.match(/^https?:\/\/[^/]+(\/.*)$/);
    return m ? m[1] : u;
  };
  const p = stripBase(url);
  if (p.startsWith("/assets/")) {
    return path.join(env.paths.assetsDir, p.slice("/assets/".length));
  }
  if (p.startsWith("/exports/")) {
    return path.join(env.paths.exportsDir, p.slice("/exports/".length));
  }
  return null;
}

/** Write a buffer into the assets dir, returning its public URL. */
export async function saveAssetBuffer(
  buffer: Buffer,
  ext: string,
): Promise<{ filename: string; url: string; filePath: string }> {
  const filename = `${randomUUID()}.${ext.replace(/^\./, "")}`;
  const filePath = path.join(env.paths.assetsDir, filename);
  await fs.writeFile(filePath, buffer);
  return { filename, url: assetUrl(filename), filePath };
}

export function assetFilePath(filename: string): string {
  return path.join(env.paths.assetsDir, filename);
}

/**
 * Download a (possibly remote) URL to a local file. Local asset/export URLs
 * are copied directly instead of round-tripping through HTTP.
 */
export async function fetchToFile(url: string, destPath: string): Promise<void> {
  await fs.mkdir(path.dirname(destPath), { recursive: true });
  const local = localPathForUrl(url);
  if (local) {
    await fs.copyFile(local, destPath);
    return;
  }
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download ${url}: HTTP ${res.status}`);
  }
  await pipeline(
    Readable.fromWeb(res.body as any),
    createWriteStream(destPath),
  );
}
