import { describe, expect, it } from "vitest";
import { labSceneData } from "@/features/experience/labData";
import { planFromHistory } from "@/features/sequencer/model/historyPlan";
import {
  makeHistory,
  makeYear,
  steadyDays,
} from "@/test-support/historyFixture";
import { thenNowScene } from "./index";

function dataFor(years: number[]) {
  const history = makeHistory(
    "ada",
    years.map((year) => makeYear(year, steadyDays(year, 1, 3))),
  );
  return { ...labSceneData(), history, model: planFromHistory(history) };
}

describe("thenNowScene", () => {
  it("is skipped without a history (the lab)", () => {
    expect(thenNowScene.create(labSceneData())).toBeNull();
  });

  it("is skipped with fewer than two full years", () => {
    expect(thenNowScene.create(dataFor([2020]))).toBeNull();
    expect(
      thenNowScene.create(dataFor([new Date().getUTCFullYear()])),
    ).toBeNull();
  });

  it("plays with two full years and has an explore phase", () => {
    const scene = thenNowScene.create(dataFor([2019, 2020, 2021]));
    expect(scene?.duration).toBeGreaterThan(0);
    expect(scene?.explore).toBeTypeOf("function");
  });
});
