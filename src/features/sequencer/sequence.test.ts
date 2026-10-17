import { describe, expect, it } from "vitest";
import {
  buildSequence,
  sceneOffsets,
  sceneTicks,
  sequenceProgress,
} from "./sequence";
import type { SceneData, SceneDefinition, SceneInstance } from "./types";

const data = {} as SceneData;

function instance(duration: number): SceneInstance {
  return { duration, bpm: 120, view: null, mount: () => () => {} };
}

function definition(
  id: string,
  create: SceneDefinition["create"],
): SceneDefinition {
  return { id, label: id, create };
}

describe("buildSequence", () => {
  it("keeps registry order and drops scenes with nothing to show", () => {
    const sequence = buildSequence(
      [
        definition("a", () => instance(4)),
        definition("b", () => null),
        definition("c", () => instance(6)),
      ],
      data,
    );
    expect(sequence.map((scene) => scene.id)).toEqual(["a", "c"]);
  });

  it("skips a scene that throws instead of failing the sequence", () => {
    const sequence = buildSequence(
      [
        definition("boom", () => {
          throw new Error("bad data");
        }),
        definition("ok", () => instance(3)),
      ],
      data,
    );
    expect(sequence.map((scene) => scene.id)).toEqual(["ok"]);
  });

  it("drops scenes with no duration", () => {
    expect(
      buildSequence([definition("zero", () => instance(0))], data),
    ).toEqual([]);
  });
});

describe("sequence timeline", () => {
  const durations = [4, 6, 10];

  it("places each scene after the previous ones", () => {
    expect(sceneOffsets(durations)).toEqual([0, 4, 10]);
  });

  it("places ticks on the boundaries between scenes", () => {
    expect(sceneTicks(durations)).toEqual([0.2, 0.5]);
    expect(sceneTicks([5])).toEqual([]);
    expect(sceneTicks([])).toEqual([]);
  });

  it("maps scene time to overall progress", () => {
    expect(sequenceProgress(durations, 0, 0)).toBe(0);
    expect(sequenceProgress(durations, 1, 3)).toBeCloseTo(0.35);
    expect(sequenceProgress(durations, 2, 10)).toBe(1);
  });

  it("clamps local time to the scene", () => {
    expect(sequenceProgress(durations, 0, 99)).toBeCloseTo(0.2);
    expect(sequenceProgress(durations, 1, -3)).toBeCloseTo(0.2);
    expect(sequenceProgress([], 0, 1)).toBe(0);
  });
});
