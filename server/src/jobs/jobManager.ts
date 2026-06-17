/**
 * Generation orchestration. Fires per-scene pipelines concurrently; the fal
 * calls inside them are throttled by a global semaphore (MAX_CONCURRENT_JOBS).
 * Every step updates the store so the /status polling endpoint reflects live
 * progress. One scene failing never kills the batch (per-scene isolation).
 */

import { env } from "../env.js";
import { store } from "../store/store.js";
import { Semaphore } from "../util/semaphore.js";
import { generateImage, assembleImagePrompt } from "../services/image.service.js";
import { generateVideo, assembleMotionPrompt } from "../services/video.service.js";
import { getVideoModel } from "../config/models.config.js";
import { isScene, type JobStatus, type Scene } from "@storyforge/shared";

const sem = new Semaphore(env.MAX_CONCURRENT_JOBS);

/** projectId -> number of scene pipelines currently in flight. */
const activeCount = new Map<string, number>();

export function isBusy(projectId: string): boolean {
  return (activeCount.get(projectId) ?? 0) > 0;
}

function incr(projectId: string) {
  activeCount.set(projectId, (activeCount.get(projectId) ?? 0) + 1);
}
function decr(projectId: string) {
  const n = (activeCount.get(projectId) ?? 1) - 1;
  if (n <= 0) activeCount.delete(projectId);
  else activeCount.set(projectId, n);
}

/** Patch a single scene by id within the project's serialized write lock. */
async function patchScene(
  projectId: string,
  sceneId: string,
  patch: Partial<Scene>,
): Promise<void> {
  await store.update(projectId, (p) => {
    const scene = p.items.find((i) => i.id === sceneId);
    if (scene && isScene(scene)) Object.assign(scene, patch);
  });
}

/**
 * Full pipeline for one scene: generate image(s) -> generate clip. Each fal
 * call passes through the semaphore. Errors are captured per-scene.
 * When `videoOnly` is set, reuses the existing stills and only re-renders the
 * clip (no image re-spend) — provided the stills exist.
 */
async function runScenePipeline(
  projectId: string,
  sceneId: string,
  opts: { videoOnly?: boolean } = {},
): Promise<void> {
  incr(projectId);
  try {
    const project = await store.get(projectId);
    if (!project) return;
    const scene = project.items.find((i) => i.id === sceneId);
    if (!scene || !isScene(scene)) return;

    const cfg = getVideoModel(scene.videoModel);
    const aspect = project.aspectRatio;
    const ref = project.characterRefImageUrl;

    const haveStills =
      !!scene.startImageUrl && (!cfg.needsEndFrame || !!scene.endImageUrl);
    const videoOnly = !!opts.videoOnly && haveStills;

    let startImageUrl: string = scene.startImageUrl ?? "";
    let endImageUrl: string | undefined = scene.endImageUrl;

    // ---- image phase (skipped for video-only regenerate) ----
    if (videoOnly) {
      await patchScene(projectId, sceneId, {
        videoStatus: "queued",
        error: undefined,
      });
    } else {
      await patchScene(projectId, sceneId, {
        imageStatus: "queued",
        videoStatus: "queued",
        error: undefined,
      });
    }

    if (!videoOnly) {
    try {
      await patchScene(projectId, sceneId, { imageStatus: "running" });

      const startPrompt = assembleImagePrompt(project.stylePreset, scene.imagePrompt);
      const tasks: Promise<void>[] = [];

      let startUrl = "";
      tasks.push(
        sem
          .run(() =>
            generateImage({
              prompt: startPrompt,
              aspect,
              referenceImageUrl: ref,
              tag: "start",
            }),
          )
          .then((u) => {
            startUrl = u;
          }),
      );

      let endUrl: string | undefined;
      if (cfg.needsEndFrame) {
        const endPrompt = assembleImagePrompt(
          project.stylePreset,
          scene.endImagePrompt || scene.imagePrompt,
        );
        tasks.push(
          sem
            .run(() =>
              generateImage({
                prompt: endPrompt,
                aspect,
                referenceImageUrl: ref,
                tag: "end",
              }),
            )
            .then((u) => {
              endUrl = u;
            }),
        );
      }

      await Promise.all(tasks);
      startImageUrl = startUrl;
      endImageUrl = endUrl;

      await patchScene(projectId, sceneId, {
        imageStatus: "done",
        startImageUrl,
        imageUrl: startImageUrl,
        endImageUrl,
      });
    } catch (err: any) {
      await patchScene(projectId, sceneId, {
        imageStatus: "error",
        videoStatus: "idle",
        error: `Image: ${err?.message ?? String(err)}`,
      });
      return;
    }
    } // end image phase (skipped when videoOnly)

    // ---- video phase ----
    try {
      await patchScene(projectId, sceneId, { videoStatus: "running" });
      const motion = assembleMotionPrompt(scene.motionPrompt, project.motionSuffix);
      const videoUrl = await sem.run(() =>
        generateVideo({
          model: scene.videoModel,
          motionPrompt: motion,
          startImageUrl,
          endImageUrl,
          durationSec: scene.durationSec,
          aspect,
        }),
      );
      await patchScene(projectId, sceneId, { videoStatus: "done", videoUrl });
    } catch (err: any) {
      await patchScene(projectId, sceneId, {
        videoStatus: "error",
        error: `Video: ${err?.message ?? String(err)}`,
      });
    }
  } finally {
    decr(projectId);
  }
}

/**
 * Generate every scene that isn't already fully done. Returns immediately;
 * pipelines run in the background and report via /status. (Per-scene
 * regenerate is the way to redo a completed scene.)
 */
export async function generateAll(projectId: string): Promise<number> {
  const project = await store.get(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  const scenes = project.items
    .filter(isScene)
    .filter((s) => s.videoStatus !== "done");
  for (const scene of scenes) {
    void runScenePipeline(projectId, scene.id);
  }
  return scenes.length;
}

/** Regenerate a single scene without touching the others (idempotent). */
export async function regenerateItem(
  projectId: string,
  itemId: string,
  opts: { videoOnly?: boolean } = {},
): Promise<boolean> {
  const project = await store.get(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  const item = project.items.find((i) => i.id === itemId);
  if (!item || !isScene(item)) return false;
  void runScenePipeline(projectId, itemId, opts);
  return true;
}

/** Compact per-item status snapshot for polling. */
export function statusOf(projectId: string, project: {
  id: string;
  items: any[];
  exportStatus: JobStatus;
  exportProgress?: number;
  exportUrl?: string;
  exportError?: string;
}) {
  return {
    projectId: project.id,
    items: project.items
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((i) =>
        i.kind === "scene"
          ? {
              id: i.id,
              kind: "scene" as const,
              order: i.order,
              imageStatus: i.imageStatus,
              videoStatus: i.videoStatus,
              imageUrl: i.imageUrl,
              startImageUrl: i.startImageUrl,
              endImageUrl: i.endImageUrl,
              videoUrl: i.videoUrl,
              error: i.error,
            }
          : { id: i.id, kind: "title" as const, order: i.order },
      ),
    exportStatus: project.exportStatus,
    exportProgress: project.exportProgress,
    exportUrl: project.exportUrl,
    exportError: project.exportError,
    busy: isBusy(projectId),
  };
}
