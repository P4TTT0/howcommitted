import { findElement } from "@/features/sequencer/explore";
import type { SceneRuntime } from "@/features/sequencer/types";
import { semitonesForDegree } from "@/playback/pitch";
import { type Arrival, progressAt, segmentScales } from "./plan";

/**
 * Wires the arrival to the sequencer's clock: each row draws from the day the
 * account was created to today, one row after the other, then the sentences
 * fade in. Every value is a pure function of clock time, written per frame
 * only when it changes. One soft tick per row and one accent per sentence; no
 * timers of its own. Returns the cleanup.
 */
export function mountVersusArrival(
  root: HTMLElement,
  arrival: Arrival,
  { clock, sound, reducedMotion }: SceneRuntime,
): () => void {
  const rows = arrival.rows.map((row) => {
    const li = findElement<HTMLElement>(root, `[data-row="${row.index}"]`);
    return {
      row,
      wait: li.querySelector<HTMLElement>('[data-part="wait"]'),
      bar: li.querySelector<HTMLElement>('[data-part="bar"]'),
      ring: li.querySelector<HTMLElement>('[data-part="ring"]'),
    };
  });
  const sentences = arrival.sentences.map((_, index) =>
    findElement<HTMLElement>(root, `[data-sentence="${index}"]`),
  );

  arrival.rowStarts.forEach((time, index) => {
    clock.at(time, (at) =>
      sound()?.playTick({
        time: at,
        semitones: semitonesForDegree(index * 2),
        intensity: 0.7,
      }),
    );
  });
  for (const time of arrival.sentenceTimes) {
    clock.at(time, (at) => sound()?.playAccent(at));
  }

  const shown = rows.map(() => Number.NaN);
  const faded = sentences.map(() => Number.NaN);

  const render = (seconds: number) => {
    rows.forEach(({ row, wait, bar, ring }, index) => {
      const start = arrival.rowStarts[index] ?? 0;
      const progress = progressAt(
        seconds,
        start,
        arrival.rowSeconds,
        reducedMotion,
      );
      if (progress === shown[index]) return;
      shown[index] = progress;
      const scales = segmentScales(row, progress);
      if (wait) wait.style.transform = `scaleX(${scales.wait})`;
      if (bar) bar.style.transform = `scaleX(${scales.bar})`;
      if (ring) ring.style.opacity = progress > 0 ? "1" : "0";
    });
    sentences.forEach((element, index) => {
      const fade = progressAt(
        seconds,
        arrival.sentenceTimes[index] ?? 0,
        arrival.sentenceSeconds,
        reducedMotion,
      );
      if (fade === faded[index]) return;
      faded[index] = fade;
      element.style.opacity = String(fade);
    });
  };

  // Hide the finished markup before the first frame is painted.
  render(0);
  const stop = clock.onFrame(render);
  return () => {
    stop();
    for (const { wait, bar, ring } of rows) {
      if (wait) wait.style.transform = "";
      if (bar) bar.style.transform = "";
      if (ring) ring.style.opacity = "";
    }
    for (const element of sentences) element.style.opacity = "";
  };
}
