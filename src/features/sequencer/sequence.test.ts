import { describe, expect, it, vi } from "vitest";
import { buildSequence, sceneTicks, sequenceProgress } from "./sequence";
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
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
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
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("drops scenes with no duration", () => {
    expect(
      buildSequence([definition("zero", () => instance(0))], data),
    ).toEqual([]);
  });
});

describe("sequence track", () => {
  it("places ticks on the equal boundaries between scenes", () => {
    expect(sceneTicks(4)).toEqual([0.25, 0.5, 0.75]);
    expect(sceneTicks(1)).toEqual([]);
    expect(sceneTicks(0)).toEqual([]);
  });

  it("maps a scene and how far into it to progress along the track", () => {
    expect(sequenceProgress(4, 0, 0)).toBe(0);
    expect(sequenceProgress(4, 1, 0.5)).toBeCloseTo(0.375);
    expect(sequenceProgress(4, 3, 1)).toBe(1);
  });

  it("clamps the fraction to the scene", () => {
    expect(sequenceProgress(4, 0, 9)).toBeCloseTo(0.25);
    expect(sequenceProgress(4, 1, -3)).toBeCloseTo(0.25);
    expect(sequenceProgress(0, 0, 1)).toBe(0);
  });
});
