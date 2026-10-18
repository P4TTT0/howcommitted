import { bigNumbersScene } from "@/features/scenes/big-numbers";
import { endCardFinale } from "@/features/scenes/finale";
import { heatmapScene } from "@/features/scenes/heatmap";
import { languageMosaicScene } from "@/features/scenes/language-mosaic";
import { timelineScene } from "@/features/scenes/timeline";
import { versusFinale } from "@/features/scenes/versus-finale";
import { versusRaceScene } from "@/features/scenes/versus-race";
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
  timelineScene,
  heatmapScene,
  languageMosaicScene,
  bigNumbersScene,
];

/**
 * What follows the last scene. Owned by the final poster: that agent replaces
 * the value of this one line (and the `finale/` folder it points to).
 */
export const FINALE: FinaleDefinition = endCardFinale;

/** The versus run: its own list and finale, played by the same sequencer. */
export const VERSUS_SCENES: readonly SceneDefinition[] = [versusRaceScene];
export const VERSUS_FINALE: FinaleDefinition = versusFinale;
