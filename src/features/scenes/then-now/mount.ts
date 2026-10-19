import { findElement } from "@/features/sequencer/explore";
import { formatCount } from "@/features/sequencer/model/format";
import type { SceneRuntime } from "@/features/sequencer/types";
import { scheduleFill } from "@/playback/sound/ticks";
import {
  barHeight,
  type Comparison,
  dayReading,
  PANEL_SECONDS,
  type PanelModel,
  progressAt,
  SUMMARY_SECONDS,
  type ThenNowPlan,
  tickLabels,
} from "./plan";

/** "Then" sits a little under "now" so the pair reads as two sides. */
const THEN_FILL_DB = -3;
const NOW_FILL_DB = 0;

/** The elements of one side that the animation and the picker both write. */
export type PanelElements = {
  /** Blocks painted with the side's background and foreground. */
  tones: HTMLElement[];
  year: HTMLElement;
  /** The year in the chart legend. */
  legend: HTMLElement;
  tag: HTMLElement;
  total: HTMLElement;
  days: HTMLElement;
  streak: HTMLElement;
  bars: HTMLElement[];
};

export function panelElements(
  root: HTMLElement,
  side: "then" | "now",
): PanelElements {
  const role = (name: string) =>
    findElement<HTMLElement>(
      root,
      `[data-side="${side}"][data-role="${name}"]`,
    );
  return {
    tones: [...root.querySelectorAll<HTMLElement>(`[data-tone="${side}"]`)],
    year: role("year"),
    legend: role("legend"),
    tag: role("tag"),
    total: role("total"),
    days: role("days"),
    streak: role("streak"),
    bars: Array.from({ length: 7 }, (_, index) =>
      findElement<HTMLElement>(
        root,
        `[data-side="${side}"][data-bar="${index}"]`,
      ),
    ),
  };
}

/** Writes a finished side: colors, numbers and week shape. */
export function writePanel(
  elements: PanelElements,
  model: PanelModel,
  axisMax: number,
): void {
  for (const tone of elements.tones) {
    tone.style.backgroundColor = model.background;
    tone.style.color = model.foreground;
  }
  elements.year.textContent = String(model.year);
  elements.legend.textContent = String(model.year);
  elements.tag.textContent = model.tag;
  elements.total.textContent = formatCount(model.total);
  elements.days.textContent = formatCount(model.activeDays);
  elements.streak.textContent = `${formatCount(model.longestStreak)}d`;
  elements.bars.forEach((bar, index) => {
    bar.style.backgroundColor = model.background;
    bar.style.height = `${barHeight(model.week[index] ?? 0, axisMax)}%`;
  });
}

/** Writes the axis labels and each weekday group's spoken label. */
export function writeAxis(root: HTMLElement, comparison: Comparison): void {
  const labels = tickLabels(comparison.axisMax);
  for (const tick of root.querySelectorAll<HTMLElement>("[data-tick]")) {
    tick.textContent = labels[Number(tick.dataset.tick)] ?? "";
  }
  for (const group of root.querySelectorAll<HTMLElement>("[data-day]")) {
    group.setAttribute(
      "aria-label",
      dayReading(comparison, Number(group.dataset.day)).label,
    );
  }
}

/** Writes the spoken form of the whole pair. */
export function writeReading(root: HTMLElement, comparison: Comparison): void {
  findElement<HTMLElement>(root, '[data-role="reading"]').setAttribute(
    "aria-label",
    `${comparison.earlier.reading} ${comparison.now.reading}`,
  );
}

/**
 * Wires the scene to the sequencer's clock: the "then" panel counts up and
 * raises its week shape, then the "now" panel does, then the summary line
 * appears. Every value is a pure function of clock time, written per frame
 * only when it changes. One fill per side, no timers of its own.
 */
export function mountThenNow(
  root: HTMLElement,
  plan: ThenNowPlan,
  { clock, sound, reducedMotion }: SceneRuntime,
): () => void {
  const { earlier, now } = plan.compare(plan.defaultThen);
  const panels = [
    {
      elements: panelElements(root, "then"),
      model: earlier,
      start: plan.thenTime,
    },
    { elements: panelElements(root, "now"), model: now, start: plan.nowTime },
  ];
  const summary = findElement<HTMLElement>(root, '[data-role="summary"]');

  // Each side's bars rise together, so each side gets one fill that climbs to
  // its total relative to the larger side. The two sides differ in level so
  // "then" and "now" do not sound identical.
  const larger = Math.max(earlier.total, now.total);
  const sides = [
    { start: plan.thenTime, db: THEN_FILL_DB, total: earlier.total },
    { start: plan.nowTime, db: NOW_FILL_DB, total: now.total },
  ].filter((side) => side.total > 0);
  // Under reduced motion both sides show at once: one fill stands for both.
  for (const { start, db, total } of reducedMotion
    ? sides.slice(0, 1)
    : sides) {
    const to = total / larger;
    scheduleFill(clock, sound, start, PANEL_SECONDS * to, { db, to });
  }

  const shown = panels.map(() => Number.NaN);
  let summaryShown = Number.NaN;

  const render = (seconds: number) => {
    panels.forEach(({ elements, model, start }, index) => {
      const progress = progressAt(start, PANEL_SECONDS, seconds, reducedMotion);
      if (progress === shown[index]) return;
      shown[index] = progress;
      elements.total.textContent = formatCount(
        Math.round(model.total * progress),
      );
      elements.days.textContent = formatCount(
        Math.round(model.activeDays * progress),
      );
      elements.streak.textContent = `${formatCount(Math.round(model.longestStreak * progress))}d`;
      for (const bar of elements.bars)
        bar.style.transform = `scaleY(${progress})`;
    });
    const fade = progressAt(
      plan.summaryTime,
      SUMMARY_SECONDS,
      seconds,
      reducedMotion,
    );
    if (fade !== summaryShown) {
      summaryShown = fade;
      summary.style.opacity = String(fade);
    }
  };

  // Hide the finished markup before the first frame is painted.
  render(0);
  const stop = clock.onFrame(render);
  return () => {
    stop();
    summary.style.opacity = "";
    for (const { elements } of panels) {
      for (const bar of elements.bars) bar.style.transform = "";
    }
  };
}
