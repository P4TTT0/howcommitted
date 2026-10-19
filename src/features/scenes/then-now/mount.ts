import { findElement } from "@/features/sequencer/explore";
import { formatCount } from "@/features/sequencer/model/format";
import type { SceneRuntime } from "@/features/sequencer/types";
import { semitonesForDegree } from "@/playback/pitch";
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
 * only when it changes. Three soft cues, no timers of its own.
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

  const cues = [
    { time: plan.thenTime, degree: 2 },
    { time: plan.nowTime, degree: 5 },
  ];
  for (const cue of cues) {
    clock.at(cue.time, (time) => {
      sound()?.playTick({
        time,
        semitones: semitonesForDegree(cue.degree),
        intensity: 0.6,
      });
    });
  }
  clock.at(plan.summaryTime, (time) => sound()?.playAccent(time));

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
