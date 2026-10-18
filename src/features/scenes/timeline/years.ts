import { formatCount } from "@/features/sequencer/model/format";
import type { Plan } from "@/features/sequencer/model/plan";

/** One year of the timeline: a block, a stretch of the line, a palette slot. */
export type YearSlot = {
  year: number;
  /** Contributions of the year: the running total's growth across it. */
  contributions: number;
  /** Position in the rotating block palette, from the first year. */
  colorIndex: number;
  /** 0..1 of the busiest year. Block height is this and nothing else. */
  ratio: number;
  /** Progress (0..1) through the drawn days where the year starts and ends. */
  startProgress: number;
  endProgress: number;
  /** Running total just before the year and at its end. */
  startTotal: number;
  endTotal: number;
  /** The year has not ended yet: its block is dashed. */
  inProgress: boolean;
};

/**
 * One slot per calendar year of the plan, oldest first. Every year takes the
 * same width on the chart (see `slotX`), whatever its number of drawn days.
 * Totals come from the plan's running total, so they add up with the counter
 * and include any "not attributed to a day" step.
 */
export function planYearSlots(plan: Plan, currentYear: number): YearSlot[] {
  const count = plan.days.length;
  const raw = plan.years.map((span, index) => {
    const startProgress = span.startProgress;
    const endProgress = plan.years[index + 1]?.startProgress ?? 1;
    const startDay = Math.round(startProgress * count);
    const endDay = Math.round(endProgress * count);
    const startTotal = startDay > 0 ? (plan.cumulative[startDay - 1] ?? 0) : 0;
    const endTotal = plan.cumulative[endDay - 1] ?? startTotal;
    return {
      year: span.year,
      startProgress,
      endProgress,
      startTotal,
      endTotal,
      contributions: Math.max(0, endTotal - startTotal),
    };
  });
  const peak = Math.max(1, ...raw.map((slot) => slot.contributions));
  return raw.map((slot, index) => ({
    ...slot,
    colorIndex: index,
    ratio: slot.contributions / peak,
    inProgress: index === raw.length - 1 && slot.year >= currentYear,
  }));
}

/**
 * Horizontal position (0..1) of a progress through the days. The years share
 * the width equally, so a short first or in-progress year still gets a full
 * block and the line crosses each block at the pace of its own days.
 */
export function slotX(slots: readonly YearSlot[], progress: number): number {
  const count = slots.length;
  if (count === 0) return 0;
  const clamped = Math.min(1, Math.max(0, progress));
  let index = slots.findIndex((slot) => clamped < slot.endProgress);
  if (index === -1) index = count - 1;
  const slot = slots[index];
  if (!slot) return 0;
  const span = slot.endProgress - slot.startProgress;
  const within = span > 0 ? (clamped - slot.startProgress) / span : 0;
  return (index + Math.min(1, Math.max(0, within))) / count;
}

/** 0..1 of a block that the running total has filled so far. */
export function yearFill(slot: YearSlot, runningTotal: number): number {
  if (slot.contributions <= 0) return runningTotal >= slot.endTotal ? 1 : 0;
  const filled = (runningTotal - slot.startTotal) / slot.contributions;
  return Math.min(1, Math.max(0, filled));
}

/** "2021" or, for the year in progress, "2021 so far". */
export function yearName(slot: Pick<YearSlot, "year" | "inProgress">): string {
  return slot.inProgress ? `${slot.year} so far` : String(slot.year);
}

/** The explore readout detail: "512 this year · 1,575 total". */
export function yearDetail(
  slot: Pick<YearSlot, "contributions" | "endTotal">,
): string {
  return `${formatCount(slot.contributions)} this year · ${formatCount(slot.endTotal)} total`;
}

/** Spoken reading of one year. */
export function yearReading(
  slot: Pick<YearSlot, "year" | "inProgress" | "contributions" | "endTotal">,
): string {
  const unit = slot.contributions === 1 ? "contribution" : "contributions";
  return `${yearName(slot)}: ${formatCount(slot.contributions)} ${unit} this year, ${formatCount(slot.endTotal)} in total`;
}
