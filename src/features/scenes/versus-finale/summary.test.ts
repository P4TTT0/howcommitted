import { describe, expect, it } from "vitest";
import { planFromHistory } from "@/features/sequencer/model/historyPlan";
import {
  makeHistory,
  makeYear,
  steadyDays,
} from "@/test-support/historyFixture";
import { summarize } from "./summary";

const today = new Date("2030-01-01T00:00:00Z");

function entry(login: string, years: number[]) {
  const history = makeHistory(
    login,
    years.map((year) => makeYear(year, steadyDays(year, 1))),
  );
  return { login, model: planFromHistory(history, today) };
}

describe("summarize", () => {
  it("lists every developer in the order they were added", () => {
    const summaries = summarize([
      entry("zed", [2023]),
      entry("ada", [2021, 2022]),
    ]);
    expect(summaries.map((s) => s.login)).toEqual(["zed", "ada"]);
    expect(summaries[0]?.span).toBe("2023");
    expect(summaries[1]?.span).toBe("2021 to 2022");
  });

  it("states calendar contributions, never commits", () => {
    const [summary] = summarize([entry("ada", [2023])]);
    expect(summary?.totalText).toMatch(/^[\d,]+ contributions$/);
    expect(summary?.totalText).not.toMatch(/commit/i);
  });

  it("handles a developer with no years", () => {
    const [summary] = summarize([entry("ada", [])]);
    expect(summary?.total).toBe(0);
    expect(summary?.span).toBe("No contributions");
  });
});
