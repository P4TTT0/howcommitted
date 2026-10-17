import type { SceneData, SceneDefinition, SceneInstance } from "./types";

export type SequencedScene = {
  id: string;
  label: string;
  instance: SceneInstance;
};

/**
 * Builds the playable list: registry order, skipping scenes with nothing to
 * show. A scene that throws while being built is skipped too, so one broken
 * scene can never take the whole experience down.
 */
export function buildSequence(
  definitions: readonly SceneDefinition[],
  data: SceneData,
): SequencedScene[] {
  const sequence: SequencedScene[] = [];
  for (const definition of definitions) {
    try {
      const instance = definition.create(data);
      if (instance && instance.duration > 0) {
        sequence.push({
          id: definition.id,
          label: definition.label,
          instance,
        });
      }
    } catch {
      // Skipped on purpose: see above.
    }
  }
  return sequence;
}

/** Start of each scene on the whole-sequence timeline, in seconds. */
export function sceneOffsets(durations: readonly number[]): number[] {
  let offset = 0;
  return durations.map((duration) => {
    const start = offset;
    offset += duration;
    return start;
  });
}

/** 0..1 across the whole sequence for a scene index and its local time. */
export function sequenceProgress(
  durations: readonly number[],
  index: number,
  seconds: number,
): number {
  const total = durations.reduce((sum, duration) => sum + duration, 0);
  if (total <= 0) return 0;
  const start = sceneOffsets(durations)[index] ?? 0;
  const local = Math.min(durations[index] ?? 0, Math.max(0, seconds));
  return Math.min(1, (start + local) / total);
}

/** 0..1 positions of the boundaries between scenes (no tick at 0 or 1). */
export function sceneTicks(durations: readonly number[]): number[] {
  const total = durations.reduce((sum, duration) => sum + duration, 0);
  if (total <= 0) return [];
  return sceneOffsets(durations)
    .slice(1)
    .map((start) => start / total);
}
