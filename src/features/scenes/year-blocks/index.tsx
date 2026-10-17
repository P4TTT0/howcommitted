import type { SceneDefinition } from "@/features/sequencer/types";
import { BPM, planYearBars } from "./bars";
import { mountYearBlocks } from "./mount";
import { YearBlocksView } from "./YearBlocksView";

/** Scene 1: one block per year, height = calendar contributions of the year. */
export const yearBlocksScene: SceneDefinition = {
  id: "year-blocks",
  label: "Year blocks",
  create({ model }) {
    const { firstYear, lastYear, yearBlocks } = model;
    if (firstYear === null || lastYear === null || model.plan.total === 0) {
      return null;
    }
    const { bars, duration } = planYearBars(yearBlocks, firstYear, lastYear);
    if (bars.length === 0) return null;
    return {
      duration,
      bpm: BPM,
      view: <YearBlocksView bars={bars} />,
      mount: (root, runtime) => mountYearBlocks(root, bars, runtime),
    };
  },
};
