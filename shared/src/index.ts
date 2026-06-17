/**
 * Shared types for StoryForge — used by both the Express backend and the
 * React frontend. This is the single source of truth for the data model
 * described in the build spec (Section 4) plus the API DTOs.
 */

export type AspectRatio = "1:1" | "16:9" | "9:16";

export type VideoModelKey = "kling" | "seedance";

export type JobStatus = "idle" | "queued" | "running" | "done" | "error";

export type OverlayPosition =
  | "top"
  | "center"
  | "bottom"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export interface TextOverlay {
  text: string;
  position: OverlayPosition;
  fontSize: number;
  color: string;
  /** Seconds (relative to the clip) the overlay appears/disappears. */
  startSec: number;
  endSec: number;
}

export interface Scene {
  id: string;
  /** Shared ordering space with title cards. */
  order: number;
  kind: "scene";

  imagePrompt: string;
  motionPrompt: string;
  videoModel: VideoModelKey;
  /** Clip duration in seconds (defaults come from the model config). */
  durationSec: number;

  // Seedance needs two frames:
  endImagePrompt?: string; // only for seedance morph scenes
  startImageUrl?: string; // generated start frame (== imageUrl for kling)
  endImageUrl?: string; // generated end frame (seedance only)

  imageUrl?: string; // generated still (for kling) = startImageUrl
  videoUrl?: string; // generated clip

  imageStatus: JobStatus;
  videoStatus: JobStatus;
  error?: string;

  /** Optional overlay burned into THIS clip. */
  textOverlay?: TextOverlay;
}

export interface TitleCard {
  id: string;
  /** Shared ordering space with scenes. */
  order: number;
  kind: "title";

  text: string;
  subtitle?: string;
  durationSec: number; // default 2
  bgColor: string; // default near-black
  textColor: string;
}

/** Anything that can live on the timeline. */
export type TimelineItem = Scene | TitleCard;

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;

  stylePreset: string; // prompt prefix applied to all image prompts
  motionSuffix: string; // appended to every motion prompt
  characterRefImageUrl?: string; // optional, for consistency
  aspectRatio: AspectRatio;

  /** Ordered mix of scenes and title cards (sort by `order`). */
  items: TimelineItem[];

  /** Path/URL of the last successful export, if any. */
  exportUrl?: string;
  exportStatus: JobStatus;
  exportProgress?: number; // 0..1 when parseable
  exportError?: string;
}

// ---------- API DTOs ----------

export interface ImageModelInfo {
  textModelId: string;
  editModelId: string;
  pricePerImage: number;
  defaultResolutionLabel: string;
}

export interface VideoModelInfo {
  key: VideoModelKey;
  label: string;
  type: "image-to-video" | "frames-to-video";
  defaultDurationSec: number;
  pricePerSecond: number;
  requiredInputs: string[];
  /** True if this model needs a generated END frame too (Seedance morph). */
  needsEndFrame: boolean;
}

/** Public, secret-free config the frontend can use for labels + cost math. */
export interface PublicConfig {
  videoModels: VideoModelInfo[];
  image: Omit<ImageModelInfo, "textModelId" | "editModelId"> & {
    pricePerImage: number;
    defaultResolutionLabel: string;
  };
  aspectRatios: AspectRatio[];
  defaultStylePreset: string;
  defaultMotionSuffix: string;
  maxConcurrentJobs: number;
  mockMode: boolean;
  /** True if the Claude prompt-assistant is usable (real key or mock). */
  assistAvailable: boolean;
  /** True if the assistant is running in mock mode (no real Claude calls). */
  assistMock: boolean;
}

// ---------- Claude prompt assistant ----------

export interface SceneSuggestion {
  imagePrompt: string;
  motionPrompt: string;
  /** Morph target for Seedance scenes; empty string when not applicable. */
  endImagePrompt: string;
}

export interface SuggestSceneInput {
  /** Rough idea / description the user typed (or the current image prompt). */
  idea: string;
  videoModel: VideoModelKey;
  aspectRatio: AspectRatio;
  /** Style preset is sent for context; the model must NOT repeat it. */
  stylePreset?: string;
}

export interface DraftStoryboardInput {
  logline: string;
  sceneCount: number;
  aspectRatio: AspectRatio;
  stylePreset?: string;
}

export interface DraftStoryboardResult {
  suggestedTitle: string;
  scenes: Array<{ imagePrompt: string; motionPrompt: string }>;
}

export interface SceneCostEstimate {
  itemId: string;
  imageCost: number;
  videoCost: number;
  total: number;
}

export interface ProjectCostEstimate {
  perItem: SceneCostEstimate[];
  total: number;
}

/** Compact per-item status used by the polling endpoint. */
export interface ProjectStatus {
  projectId: string;
  items: Array<{
    id: string;
    kind: "scene" | "title";
    order: number;
    imageStatus?: JobStatus;
    videoStatus?: JobStatus;
    imageUrl?: string;
    startImageUrl?: string;
    endImageUrl?: string;
    videoUrl?: string;
    error?: string;
  }>;
  exportStatus: JobStatus;
  exportProgress?: number;
  exportUrl?: string;
  exportError?: string;
  /** True while any generation job for this project is still in flight. */
  busy: boolean;
}

// ---------- request payloads ----------

export interface CreateProjectInput {
  name: string;
  aspectRatio?: AspectRatio;
  stylePreset?: string;
  motionSuffix?: string;
}

export type UpdateProjectInput = Partial<
  Pick<
    Project,
    | "name"
    | "stylePreset"
    | "motionSuffix"
    | "characterRefImageUrl"
    | "aspectRatio"
  >
>;

export interface CreateSceneInput {
  imagePrompt: string;
  motionPrompt?: string;
  videoModel?: VideoModelKey;
  durationSec?: number;
  endImagePrompt?: string;
  order?: number; // insert position; appended if omitted
  textOverlay?: TextOverlay;
}

export type UpdateSceneInput = Partial<
  Pick<
    Scene,
    | "imagePrompt"
    | "motionPrompt"
    | "videoModel"
    | "durationSec"
    | "endImagePrompt"
    | "textOverlay"
  >
>;

export interface CreateTitleCardInput {
  text: string;
  subtitle?: string;
  durationSec?: number;
  bgColor?: string;
  textColor?: string;
  order?: number;
}

export type UpdateTitleCardInput = Partial<
  Pick<TitleCard, "text" | "subtitle" | "durationSec" | "bgColor" | "textColor">
>;

export interface ReorderInput {
  /** Ordered list of item ids defining the new timeline order. */
  orderedIds: string[];
}

// ---------- type guards ----------

export function isScene(item: TimelineItem): item is Scene {
  return item.kind === "scene";
}

export function isTitleCard(item: TimelineItem): item is TitleCard {
  return item.kind === "title";
}
