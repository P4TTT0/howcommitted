import { describe, expect, it } from "vitest";
import { labSceneData } from "@/features/experience/labData";
import {
  makeHistory,
  makeYear,
  steadyDays,
} from "@/test-support/historyFixture";
import { heatmapScene } from "./index";

describe("heatmapScene", () => {
  it("is skipped without a history (the lab)", () => {
    expect(heatmapScene.create(labSceneData())).toBeNull();
  });

  it("is skipped when no week has contributions", () => {
    const history = makeHistory("ada", [makeYear(2024, [])]);
    expect(heatmapScene.create({ ...labSceneData(), history })).toBeNull();
  });

  it("plays every year with explore", () => {
    const history = makeHistory("ada", [
      makeYear(2023, steadyDays(2023, 2)),
      makeYear(2024, steadyDays(2024, 3)),
    ]);
    const scene = heatmapScene.create({ ...labSceneData(), history });
    expect(scene?.duration).toBeGreaterThan(0);
    expect(scene?.explore).toBeTypeOf("function");
  });
});
