import type { SceneDefinition } from "@/features/sequencer/types";
import { BPM, planLanguageBlocks } from "./blocks";
import { exploreLanguageMosaic } from "./explore";
import { LanguageMosaicView } from "./LanguageMosaicView";
import { mountLanguageMosaic } from "./mount";

/** Scene 4: proportional blocks for the top languages of owned repos. */
export const languageMosaicScene: SceneDefinition = {
  id: "language-mosaic",
  label: "Language mosaic",
  create({ history }) {
    if (!history || history.languages.length === 0) return null;
    const { blocks, duration } = planLanguageBlocks(history.languages);
    return {
      duration,
      bpm: BPM,
      view: <LanguageMosaicView blocks={blocks} />,
      mount: (root, runtime) => mountLanguageMosaic(root, blocks, runtime),
      explore: (root) => exploreLanguageMosaic(root, blocks),
    };
  },
};
