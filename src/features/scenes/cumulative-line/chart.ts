import { scaleLinear } from "d3-scale";
import { line } from "d3-shape";
import type {
  LinePoint,
  Plan,
  UnattributedStep,
} from "@/features/sequencer/model/plan";

/** The plot is drawn in a fixed box and stretched to fit its container. */
export const CHART_WIDTH = 1000;
export const CHART_HEIGHT = 500;
const PADDING = 20;

function yScale(peak: number) {
  return scaleLinear()
    .domain([0, Math.max(1, peak)])
    .range([CHART_HEIGHT - PADDING, PADDING]);
}

const xScale = scaleLinear().domain([0, 1]).range([0, CHART_WIDTH]);

/** Splits the points where a step breaks the line. */
function segments(points: readonly LinePoint[]): LinePoint[][] {
  const result: LinePoint[][] = [];
  for (const point of points) {
    const current = result.at(-1);
    if (!current || point.jump === "to") result.push([point]);
    else current.push(point);
  }
  return result;
}

/** SVG path of the real cumulative line: solid, broken wherever a step sits. */
export function linePath(plan: Plan): string {
  const y = yScale(plan.peak);
  const draw = line<LinePoint>()
    .x((point) => xScale(point.progress))
    .y((point) => y(point.total));
  return segments(plan.linePoints)
    .map((segment) => draw(segment) ?? "")
    .join(" ");
}

/** SVG path of the unattributed steps: drawn dashed, apart from the real line. */
export function stepPath(plan: Plan): string {
  const y = yScale(plan.peak);
  return plan.steps
    .map((step) => {
      const x = xScale(step.progress);
      return `M${x},${y(step.from)} L${x},${y(step.to)}`;
    })
    .join(" ");
}

/** Vertical position of a running total as a percentage of plot height. */
export function topPercent(plan: Plan, runningTotal: number): number {
  return (yScale(plan.peak)(runningTotal) / CHART_HEIGHT) * 100;
}

/** Where a step's label sits: beside the middle of its segment. */
export function stepLabelPosition(plan: Plan, step: UnattributedStep) {
  return {
    leftPercent: step.progress * 100,
    topPercent: topPercent(plan, (step.from + step.to) / 2),
  };
}
