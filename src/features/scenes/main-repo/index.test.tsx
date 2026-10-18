import { describe, expect, it } from "vitest";
import { labSceneData } from "@/features/experience/labData";
import { planFromHistory } from "@/features/sequencer/model/historyPlan";
import {
  makeHistory,
  makeYear,
  steadyDays,
} from "@/test-support/historyFixture";
import { mainRepoScene } from "./index";

function dataFor(repo: boolean) {
  const year = {
    ...makeYear(2023, steadyDays(2023, 1, 30)),
    repoCommits: repo ? [{ repo: "ada/alpha", commits: 10, days: 5 }] : [],
  };
  const history = makeHistory("ada", [year]);
  return { ...labSceneData(), history, model: planFromHistory(history) };
}

describe("mainRepoScene", () => {
  it("is skipped without a history (the lab)", () => {
    expect(mainRepoScene.create(labSceneData())).toBeNull();
  });

  it("is skipped when no public repo has commits", () => {
    expect(mainRepoScene.create(dataFor(false))).toBeNull();
  });

  it("plays with public repo commits and has an explore phase", () => {
    const scene = mainRepoScene.create(dataFor(true));
    expect(scene?.duration).toBeGreaterThan(0);
    expect(scene?.explore).toBeTypeOf("function");
  });
});
