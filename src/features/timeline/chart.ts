import { scaleLinear } from "d3-scale";
import { line } from "d3-shape";
import type { Plan } from "./plan";

/** The plot is drawn in a fixed box and stretched to fit its container. */
export const CHART_WIDTH = 1000;
export const CHART_HEIGHT = 500;
const PADDING = 20;

function yScale(total: number) {
  return scaleLinear()
    .domain([0, Math.max(1, total)])
    .range([CHART_HEIGHT - PADDING, PADDING]);
}

/** SVG path of the cumulative line for the whole history. */
export function linePath(plan: Plan): string {
  const x = scaleLinear().domain([0, 1]).range([0, CHART_WIDTH]);
  const y = yScale(plan.total);
  return (
    line<{ progress: number; total: number }>()
      .x((point) => x(point.progress))
      .y((point) => y(point.total))(plan.linePoints) ?? ""
  );
}

/** Vertical position of a running total as a percentage of plot height. */
export function topPercent(plan: Plan, runningTotal: number): number {
  return (yScale(plan.total)(runningTotal) / CHART_HEIGHT) * 100;
}
