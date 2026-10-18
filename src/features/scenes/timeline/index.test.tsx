import { describe, expect, it } from "vitest";
import { labSceneData } from "@/features/experience/labData";
import { timelineScene } from "./index";

describe("timelineScene", () => {
  it("plays the generated lab profile with explore", () => {
    const scene = timelineScene.create(labSceneData());
    expect(scene?.duration).toBeGreaterThan(0);
    expect(scene?.explore).toBeTypeOf("function");
  });

  it("is skipped when there is nothing to draw", () => {
    const data = labSceneData();
    const empty = {
      ...data,
      model: { ...data.model, plan: { ...data.model.plan, total: 0 } },
    };
    expect(timelineScene.create(empty)).toBeNull();
  });
});
