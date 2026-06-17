/**
 * Project domain logic: create/update projects, scenes, and title cards, plus
 * timeline ordering. Routes stay thin and delegate here.
 */

import { randomUUID } from "node:crypto";
import { store, StoreNotFoundError } from "../store/store.js";
import {
  DEFAULT_MOTION_SUFFIX,
  DEFAULT_STYLE_PRESET,
  getVideoModel,
} from "../config/models.config.js";
import {
  isScene,
  isTitleCard,
  type CreateProjectInput,
  type CreateSceneInput,
  type CreateTitleCardInput,
  type Project,
  type Scene,
  type TitleCard,
  type UpdateProjectInput,
  type UpdateSceneInput,
  type UpdateTitleCardInput,
} from "@storyforge/shared";

export { StoreNotFoundError };

/** Sort items by order and reassign sequential 0..n indices. */
function normalizeOrders(project: Project): void {
  project.items.sort((a, b) => a.order - b.order);
  project.items.forEach((item, i) => (item.order = i));
}

function nextOrder(project: Project): number {
  return project.items.length;
}

// ---------- projects ----------

export async function createProject(
  input: CreateProjectInput,
): Promise<Project> {
  const now = new Date().toISOString();
  const project: Project = {
    id: randomUUID(),
    name: input.name?.trim() || "Untitled Story",
    createdAt: now,
    updatedAt: now,
    stylePreset: input.stylePreset ?? DEFAULT_STYLE_PRESET,
    motionSuffix: input.motionSuffix ?? DEFAULT_MOTION_SUFFIX,
    aspectRatio: input.aspectRatio ?? "16:9",
    items: [],
    exportStatus: "idle",
  };
  return store.create(project);
}

export function listProjects(): Promise<Project[]> {
  return store.list();
}

export function getProject(id: string): Promise<Project | undefined> {
  return store.get(id);
}

export function deleteProject(id: string): Promise<boolean> {
  return store.delete(id);
}

export function updateProject(
  id: string,
  patch: UpdateProjectInput,
): Promise<Project> {
  return store.update(id, (p) => {
    if (patch.name !== undefined) p.name = patch.name;
    if (patch.stylePreset !== undefined) p.stylePreset = patch.stylePreset;
    if (patch.motionSuffix !== undefined) p.motionSuffix = patch.motionSuffix;
    if (patch.aspectRatio !== undefined) p.aspectRatio = patch.aspectRatio;
    if (patch.characterRefImageUrl !== undefined) {
      p.characterRefImageUrl = patch.characterRefImageUrl || undefined;
    }
  });
}

// ---------- scenes ----------

function makeScene(input: CreateSceneInput, order: number): Scene {
  const model = input.videoModel ?? "kling";
  const cfg = getVideoModel(model);
  return {
    id: randomUUID(),
    order,
    kind: "scene",
    imagePrompt: input.imagePrompt ?? "",
    motionPrompt: input.motionPrompt ?? "",
    videoModel: model,
    durationSec: input.durationSec ?? cfg.defaultDurationSec,
    endImagePrompt: input.endImagePrompt,
    imageStatus: "idle",
    videoStatus: "idle",
    textOverlay: input.textOverlay,
  };
}

export function addScene(
  projectId: string,
  input: CreateSceneInput,
): Promise<Project> {
  return store.update(projectId, (p) => {
    p.items.push(makeScene(input, nextOrder(p)));
    normalizeOrders(p);
  });
}

export function updateScene(
  projectId: string,
  sceneId: string,
  patch: UpdateSceneInput,
): Promise<Project> {
  return store.update(projectId, (p) => {
    const scene = p.items.find((i) => i.id === sceneId);
    if (!scene || !isScene(scene)) {
      throw new Error(`Scene not found: ${sceneId}`);
    }
    if (patch.imagePrompt !== undefined) scene.imagePrompt = patch.imagePrompt;
    if (patch.motionPrompt !== undefined) scene.motionPrompt = patch.motionPrompt;
    if (patch.endImagePrompt !== undefined) {
      scene.endImagePrompt = patch.endImagePrompt || undefined;
    }
    if (patch.textOverlay !== undefined) {
      scene.textOverlay = patch.textOverlay || undefined;
    }
    if (patch.videoModel !== undefined && patch.videoModel !== scene.videoModel) {
      scene.videoModel = patch.videoModel;
      // Switching models can invalidate generated frames/clip.
      scene.videoStatus = "idle";
      scene.videoUrl = undefined;
      if (patch.videoModel === "kling") {
        scene.endImageUrl = undefined;
      }
    }
    if (patch.durationSec !== undefined) {
      scene.durationSec = patch.durationSec;
    }
  });
}

// ---------- title cards ----------

function makeTitleCard(input: CreateTitleCardInput, order: number): TitleCard {
  return {
    id: randomUUID(),
    order,
    kind: "title",
    text: input.text ?? "",
    subtitle: input.subtitle,
    durationSec: input.durationSec ?? 2,
    bgColor: input.bgColor ?? "#0a0b0f",
    textColor: input.textColor ?? "#ffffff",
  };
}

export function addTitleCard(
  projectId: string,
  input: CreateTitleCardInput,
): Promise<Project> {
  return store.update(projectId, (p) => {
    p.items.push(makeTitleCard(input, nextOrder(p)));
    normalizeOrders(p);
  });
}

export function updateTitleCard(
  projectId: string,
  titleId: string,
  patch: UpdateTitleCardInput,
): Promise<Project> {
  return store.update(projectId, (p) => {
    const card = p.items.find((i) => i.id === titleId);
    if (!card || !isTitleCard(card)) {
      throw new Error(`Title card not found: ${titleId}`);
    }
    if (patch.text !== undefined) card.text = patch.text;
    if (patch.subtitle !== undefined) card.subtitle = patch.subtitle || undefined;
    if (patch.durationSec !== undefined) card.durationSec = patch.durationSec;
    if (patch.bgColor !== undefined) card.bgColor = patch.bgColor;
    if (patch.textColor !== undefined) card.textColor = patch.textColor;
  });
}

// ---------- timeline ----------

export function deleteItem(
  projectId: string,
  itemId: string,
): Promise<Project> {
  return store.update(projectId, (p) => {
    p.items = p.items.filter((i) => i.id !== itemId);
    normalizeOrders(p);
  });
}

export function reorderItems(
  projectId: string,
  orderedIds: string[],
): Promise<Project> {
  return store.update(projectId, (p) => {
    const indexOf = new Map(orderedIds.map((id, i) => [id, i]));
    for (const item of p.items) {
      const idx = indexOf.get(item.id);
      if (idx !== undefined) item.order = idx;
    }
    normalizeOrders(p);
  });
}
