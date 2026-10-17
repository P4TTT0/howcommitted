import { describe, expect, it } from "vitest";
import { labSceneData } from "./labData";

describe("labSceneData", () => {
  it("maps the generated profile like a real history", () => {
    const { model, history } = labSceneData();
    const blocksTotal = model.yearBlocks.reduce(
      (sum, block) => sum + block.contributions,
      0,
    );
    expect(history).toBeNull();
    expect(blocksTotal).toBe(model.plan.total);
    expect(model.firstYear).toBe(model.yearBlocks[0]?.year);
    expect(model.lastYear).toBe(model.yearBlocks.at(-1)?.year);
  });
});
