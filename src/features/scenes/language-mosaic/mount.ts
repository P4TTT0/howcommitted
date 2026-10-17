import { findElement } from "@/features/sequencer/explore";
import type { SceneRuntime } from "@/features/sequencer/types";
import { semitonesForDegree } from "@/playback/pitch";
import {
  activeBlockIndex,
  formatShare,
  type LanguageBlock,
  riseProgress,
} from "./blocks";

/**
 * Wires the mosaic to the sequencer's clock. Each block's rise is a pure
 * function of clock time, written per frame only when it changes; one tick per
 * language (at most six) is scheduled on the Transport. No timers of its own.
 */
export function mountLanguageMosaic(
  root: HTMLElement,
  blocks: readonly LanguageBlock[],
  { clock, sound, reducedMotion }: SceneRuntime,
): () => void {
  const columns = blocks.map((_, index) =>
    findElement<HTMLElement>(root, `[data-block="${index}"]`),
  );
  const readout = findElement<HTMLElement>(root, '[data-role="readout"]');
  const nameText = findElement<HTMLElement>(readout, '[data-role="name"]');
  const valueText = findElement<HTMLElement>(readout, '[data-role="value"]');

  blocks.forEach((block, index) => {
    const isLast = index === blocks.length - 1;
    clock.at(block.time, (time) => {
      const engine = sound();
      engine?.playTick({
        time,
        semitones: semitonesForDegree(block.degree),
        intensity: 0.4 + 0.6 * block.share,
      });
      if (isLast) engine?.playAccent(time);
    });
  });

  const scales = blocks.map(() => Number.NaN);
  let shown = -1;
  let shownValue = "";

  const render = (seconds: number) => {
    blocks.forEach((block, index) => {
      const progress = riseProgress(block, seconds, reducedMotion);
      if (progress === scales[index]) return;
      scales[index] = progress;
      const column = columns[index];
      if (column) column.style.transform = `scaleY(${progress})`;
    });

    const active = activeBlockIndex(blocks, seconds);
    const block = blocks[active];
    if (!block) return;
    if (active !== shown) {
      shown = active;
      readout.style.backgroundColor = block.background;
      readout.style.color = block.foreground;
      nameText.textContent = block.name;
    }
    const value = formatShare(
      block.share * riseProgress(block, seconds, reducedMotion),
    );
    if (value !== shownValue) {
      shownValue = value;
      valueText.textContent = value;
    }
  };

  // Hide the finished markup before the first frame is painted.
  render(0);
  return clock.onFrame(render);
}
