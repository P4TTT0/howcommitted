import type { SceneDefinition } from "@/features/sequencer/types";
import { exploreHeatmap } from "./explore";
import { HeatmapView } from "./HeatmapView";
import { mountHeatmap } from "./mount";
import { BPM, latestYearCells, planReveal } from "./plan";

/** Scene 3: the latest year of calendar days, weekday by week. */
export const heatmapScene: SceneDefinition = {
  id: "heatmap",
  label: "Heatmap",
  create({ history }) {
    if (!history) return null;
    const latest = latestYearCells(history.years);
    if (!latest) return null;
    const { year, cells } = latest;
    if (cells.every((cell) => cell.contributions === 0)) return null;
    const plan = planReveal(cells);
    return {
      duration: plan.duration,
      bpm: BPM,
      view: <HeatmapView year={year} weeks={plan.weeks} cells={cells} />,
      mount: (root, runtime) => mountHeatmap(root, plan, runtime),
      explore: (root) => exploreHeatmap(root, cells, plan.weeks),
    };
  },
};
