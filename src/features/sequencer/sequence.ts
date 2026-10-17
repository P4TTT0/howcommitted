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
    } catch (error) {
      // Skipped on purpose (see above), but never silently in development.
      if (process.env.NODE_ENV !== "production") {
        console.error(`Scene "${definition.id}" failed to build`, error);
      }
    }
  }
  return sequence;
}

/**
 * The progress track gives every scene an equal share, not a share of its
 * duration: a three second scene must stay as easy to click as a thirty second
 * one. These helpers work in 0..1 along the track.
 */

/** 0..1 across the track for a scene index and how far into the scene it is. */
export function sequenceProgress(
  count: number,
  index: number,
  fraction: number,
): number {
  if (count <= 0) return 0;
  const local = Math.min(1, Math.max(0, fraction));
  return Math.min(1, (index + local) / count);
}

/** 0..1 positions of the boundaries between scenes (no tick at 0 or 1). */
export function sceneTicks(count: number): number[] {
  return Array.from(
    { length: Math.max(0, count - 1) },
    (_, i) => (i + 1) / count,
  );
}
