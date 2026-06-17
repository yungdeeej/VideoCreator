/**
 * Async export orchestration. The HTTP request returns immediately; the
 * combine runs in the background and reports progress via the project's
 * exportStatus/exportProgress (surfaced by /status polling).
 */

import { store } from "../store/store.js";
import { combineProject } from "./ffmpeg.service.js";

const exporting = new Set<string>();

export function isExporting(projectId: string): boolean {
  return exporting.has(projectId);
}

export async function startExport(projectId: string): Promise<boolean> {
  const project = await store.get(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  if (exporting.has(projectId)) return false; // already rendering

  exporting.add(projectId);
  await store.update(projectId, (p) => {
    p.exportStatus = "running";
    p.exportProgress = 0;
    p.exportError = undefined;
  });
  void runExport(projectId);
  return true;
}

async function runExport(projectId: string): Promise<void> {
  try {
    const project = await store.get(projectId);
    if (!project) return;

    let lastWritten = 0;
    const result = await combineProject(project, (p) => {
      // Throttle store writes to ~every 2% of progress.
      if (p - lastWritten >= 0.02 || p >= 1) {
        lastWritten = p;
        void store
          .update(projectId, (pr) => {
            pr.exportProgress = p;
          })
          .catch(() => {});
      }
    });

    await store.update(projectId, (p) => {
      p.exportStatus = "done";
      p.exportProgress = 1;
      p.exportUrl = result.url;
      p.exportError = undefined;
    });
  } catch (err: any) {
    await store.update(projectId, (p) => {
      p.exportStatus = "error";
      p.exportError = err?.message ?? String(err);
    });
  } finally {
    exporting.delete(projectId);
  }
}
