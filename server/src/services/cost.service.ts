import { IMAGE_MODEL, getVideoModel } from "../config/models.config.js";
import {
  isScene,
  type Project,
  type ProjectCostEstimate,
} from "@storyforge/shared";

/** Estimate generation cost using prices from models.config.ts. */
export function estimateProjectCost(project: Project): ProjectCostEstimate {
  const perItem = project.items.filter(isScene).map((s) => {
    const cfg = getVideoModel(s.videoModel);
    const numImages = cfg.needsEndFrame ? 2 : 1;
    const imageCost = IMAGE_MODEL.pricePerImage * numImages;
    const videoCost = cfg.pricePerSecond * s.durationSec;
    return {
      itemId: s.id,
      imageCost,
      videoCost,
      total: imageCost + videoCost,
    };
  });
  return {
    perItem,
    total: perItem.reduce((sum, e) => sum + e.total, 0),
  };
}
