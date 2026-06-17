import { isScene, type Project, type ProjectStatus } from "@storyforge/shared";

/**
 * Overlay a live status snapshot (statuses + generated URLs + export state)
 * onto the canonical project so the storyboard reflects progress without a
 * full reload. The project keeps the editable fields (prompts, model, etc.).
 */
export function mergeStatus(
  project: Project,
  status: ProjectStatus | null,
): Project {
  if (!status) return project;
  const byId = new Map(status.items.map((i) => [i.id, i]));
  const items = project.items.map((item) => {
    if (!isScene(item)) return item;
    const s = byId.get(item.id);
    if (!s || s.kind !== "scene") return item;
    return {
      ...item,
      imageStatus: s.imageStatus ?? item.imageStatus,
      videoStatus: s.videoStatus ?? item.videoStatus,
      imageUrl: s.imageUrl ?? item.imageUrl,
      startImageUrl: s.startImageUrl ?? item.startImageUrl,
      endImageUrl: s.endImageUrl ?? item.endImageUrl,
      videoUrl: s.videoUrl ?? item.videoUrl,
      error: s.error,
    };
  });
  return {
    ...project,
    items,
    exportStatus: status.exportStatus ?? project.exportStatus,
    exportProgress: status.exportProgress,
    exportUrl: status.exportUrl ?? project.exportUrl,
    exportError: status.exportError,
  };
}
