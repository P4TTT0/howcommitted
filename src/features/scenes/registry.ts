import { cumulativeLineScene } from "@/features/scenes/cumulative-line";
import { endCardFinale } from "@/features/scenes/finale";
import { heatmapScene } from "@/features/scenes/heatmap";
import { yearBlocksScene } from "@/features/scenes/year-blocks";
import type {
  FinaleDefinition,
  SceneDefinition,
} from "@/features/sequencer/types";

/**
 * The scenes, in playback order. A new scene is one import line above and one
 * entry line below, placed where it plays. The sequencer is never edited.
 * Contract: `features/sequencer/types.ts` and docs/architecture.md.
 */
export const SCENES: readonly SceneDefinition[] = [
  yearBlocksScene,
  cumulativeLineScene,
  heatmapScene,
  // 4 Language mosaic goes here.
  // 5 Big numbers goes here.
];

/**
 * What follows the last scene. Owned by the final poster: that agent replaces
 * the value of this one line (and the `finale/` folder it points to).
 */
export const FINALE: FinaleDefinition = endCardFinale;
