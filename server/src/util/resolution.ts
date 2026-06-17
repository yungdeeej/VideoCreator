import type { AspectRatio } from "@storyforge/shared";

export interface Dims {
  w: number;
  h: number;
}

/**
 * Target output dimensions per aspect ratio. Kept ~720p/1K on purpose:
 * higher resolution makes pixel art smoother/worse and costs more.
 */
export function dimsFor(aspect: AspectRatio): Dims {
  switch (aspect) {
    case "16:9":
      return { w: 1280, h: 720 };
    case "9:16":
      return { w: 720, h: 1280 };
    case "1:1":
      return { w: 1024, h: 1024 };
    default:
      return { w: 1280, h: 720 };
  }
}
