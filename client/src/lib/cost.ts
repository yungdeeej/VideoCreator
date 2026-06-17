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

export function fmtUSD(n: number): string {
  return `$${n.toFixed(2)}`;
}
