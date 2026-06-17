import {
  isScene,
  type Project,
  type ProjectCostEstimate,
  type PublicConfig,
  type Scene,
  type SceneCostEstimate,
} from "@storyforge/shared";

export function sceneCost(
  scene: Scene,
  config: PublicConfig,
): SceneCostEstimate {
  const model = config.videoModels.find((m) => m.key === scene.videoModel);
  const numImages = model?.needsEndFrame ? 2 : 1;
  const imageCost = config.image.pricePerImage * numImages;
  const videoCost = (model?.pricePerSecond ?? 0) * scene.durationSec;
  return {
    itemId: scene.id,
    imageCost,
    videoCost,
    total: imageCost + videoCost,
  };
}

export function projectCost(
  project: Project,
  config: PublicConfig,
): ProjectCostEstimate {
  const perItem = project.items
    .filter(isScene)
    .map((s) => sceneCost(s, config));
  const total = perItem.reduce((sum, e) => sum + e.total, 0);
  return { perItem, total };
}

/**
 * Running tally of what's actually been spent so far: image cost counts once
 * a scene's image(s) are done, video cost once the clip is done.
 */
export function projectSpent(project: Project, config: PublicConfig): number {
  return project.items.filter(isScene).reduce((sum, s) => {
    const c = sceneCost(s, config);
    let spent = 0;
    if (s.imageStatus === "done") spent += c.imageCost;
    if (s.videoStatus === "done") spent += c.videoCost;
    return sum + spent;
  }, 0);
}

export function fmtUSD(n: number): string {
  return `$${n.toFixed(2)}`;
}
