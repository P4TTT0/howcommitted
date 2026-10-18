import type { SceneDefinition } from "@/features/sequencer/types";
import { exploreHeatmap } from "./explore";
import { HeatmapView } from "./HeatmapView";
import { planMonthStrip } from "./months";
import { mountHeatmap } from "./mount";
import { BPM, planReveal, planRows, weeklyTotals } from "./plan";

/** Scene 2: every year as a row of week squares, plus the month strip. */
export const heatmapScene: SceneDefinition = {
  id: "heatmap",
  label: "Heatmap",
  create({ history }) {
    if (!history) return null;
    const rows = planRows(history.years, new Date());
    const totals = weeklyTotals(rows);
    if (totals.every((total) => total === 0)) return null;
    const plan = planReveal(totals);
    const strip = planMonthStrip(
      history.years.flatMap((year) => year.dailyContributions),
    );
    return {
      duration: plan.duration,
      bpm: BPM,
      view: <HeatmapView rows={rows} strip={strip} />,
      mount: (root, runtime) => mountHeatmap(root, plan, runtime),
      explore: (root) => exploreHeatmap(root, rows),
    };
  },
};
