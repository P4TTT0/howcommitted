import { cumulativeLineScene } from "@/features/scenes/cumulative-line";
import { endCardFinale } from "@/features/scenes/finale";
import { yearBlocksScene } from "@/features/scenes/year-blocks";
import type {
  FinaleDefinition,
  SceneDefinition,
} from "@/features/sequencer/types";

/**
 * The scenes, in playback order. Adding a scene is one import and one entry
 * here; the sequencer is never edited. The contract is in
 * `features/sequencer/types.ts` and docs/architecture.md.
 */
export const SCENES: readonly SceneDefinition[] = [
  yearBlocksScene,
  cumulativeLineScene,
];

/** What follows the last scene. The final poster replaces this one entry. */
export const FINALE: FinaleDefinition = endCardFinale;
