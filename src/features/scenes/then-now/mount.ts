import { findElement } from "@/features/sequencer/explore";
import { formatCount } from "@/features/sequencer/model/format";
import type { SceneRuntime } from "@/features/sequencer/types";
import { semitonesForDegree } from "@/playback/pitch";
import {
  PANEL_SECONDS,
  type PanelModel,
  progressAt,
  SUMMARY_SECONDS,
  type ThenNowPlan,
} from "./plan";

/** The elements of one panel that the animation and the picker both write. */
export type PanelElements = {
  root: HTMLElement;
  year: HTMLElement;
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
  const panel = findElement<HTMLElement>(root, `[data-panel="${side}"]`);
  const role = (name: string) =>
    findElement<HTMLElement>(panel, `[data-role="${name}"]`);
  return {
    root: panel,
    year: role("year"),
    tag: role("tag"),
    total: role("total"),
    days: role("days"),
    streak: role("streak"),
    bars: Array.from({ length: 7 }, (_, index) =>
      findElement<HTMLElement>(panel, `[data-bar="${index}"]`),
    ),
  };
}

/** Writes a finished panel: colors, numbers, week shape and its spoken form. */
export function writePanel(elements: PanelElements, model: PanelModel): void {
  elements.root.style.backgroundColor = model.background;
  elements.root.style.color = model.foreground;
  elements.root.setAttribute("aria-label", model.reading);
  elements.year.textContent = String(model.year);
  elements.tag.textContent = model.tag;
  elements.total.textContent = formatCount(model.total);
  elements.days.textContent = formatCount(model.activeDays);
  elements.streak.textContent = `${formatCount(model.longestStreak)}d`;
  model.week.forEach((ratio, index) => {
    const bar = elements.bars[index];
    if (bar) bar.style.height = `${Math.round(ratio * 100)}%`;
  });
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
