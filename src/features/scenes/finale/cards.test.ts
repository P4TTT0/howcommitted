import { describe, expect, it } from "vitest";
import type { History } from "@/domain/history";
import { labSceneData } from "@/features/experience/labData";
import { planFromHistory } from "@/features/sequencer/model/historyPlan";
import {
  makeHistory,
  makeYear,
  steadyDays,
} from "@/test-support/historyFixture";
import { buildShareCards, CARD_SIZE } from "./cards";
import { FIXED_LINE } from "./poster";

function dataFor(overrides: Partial<History> = {}, withRepo = true) {
  const years = [2022, 2023, 2024].map((year, index) => ({
    ...makeYear(year, steadyDays(year, 2 + index, 2)),
    repoCommits: withRepo
      ? [{ repo: "ada/alpha", commits: 100 * (index + 1), days: 20 }]
      : [],
  }));
  const history: History = {
    ...makeHistory("ada", years),
    longestStreak: { length: 12, start: "2023-03-01", end: "2023-03-12" },
    languages: [
      { name: "Rust", size: 90, share: 0.9, isOther: false },
      { name: "Other", size: 10, share: 0.1, isOther: true },
    ],
    ...overrides,
  };
  return { login: "ada", model: planFromHistory(history), history };
}

describe("buildShareCards", () => {
  it("builds the poster, rhythm and eras cards from a full history", () => {
    const cards = buildShareCards(dataFor());
    expect(cards.map((card) => card.id)).toEqual(["poster", "rhythm", "eras"]);
    for (const card of cards) {
      expect(card.notes).toContain(FIXED_LINE);
      expect(card.address).toBe("howcommitted.com/ada");
      expect(card.filename).toBe(`committed-ada-${card.id}`);
    }
  });

  it("is 9:16", () => {
    expect(CARD_SIZE.width / CARD_SIZE.height).toBeCloseTo(9 / 16, 5);
  });

  it("puts calendar totals, the streak and the top language on the poster", () => {
    const [poster] = buildShareCards(dataFor());
    expect(poster?.kind).toBe("poster");
    if (poster?.kind !== "poster") return;
    expect(poster.range).toBe("2022 — 2024");
    expect(poster.headline).toBe("Contributions.");
    expect(poster.facts.map((fact) => [fact.label, fact.value])).toEqual([
      ["Longest streak", "12 days"],
      ["Busiest day", "4"],
      ["Built with", "Rust"],
    ]);
    expect(poster.bars).toHaveLength(3);
  });

  it("never calls the calendar commits", () => {
    const text = JSON.stringify(
      buildShareCards(dataFor()).flatMap((card) =>
        card.kind === "eras"
          ? [card.alt, card.kicker, card.heading, card.notes]
          : [card.alt, card.notes],
      ),
    );
    expect(text).not.toMatch(/\bcommits\b/i);
    expect(text).not.toMatch(/best|winner|most productive|percentile/i);
  });

  it("states the private share on the poster only when there is one", () => {
    const base = buildShareCards(dataFor())[0];
    expect(base?.notes.join(" ")).not.toMatch(/private/i);

    const years = [
      makeYear(2024, steadyDays(2024, 2, 2), { privateContributions: 40 }),
    ];
    const history = makeHistory("ada", years);
    const [poster] = buildShareCards({
      login: "ada",
      model: planFromHistory(history),
      history,
    });
    expect(poster?.notes).toContain("Includes 40 private contributions.");
  });

  it("skips the eras card when no public repository has commits", () => {
    const ids = buildShareCards(dataFor({}, false)).map((card) => card.id);
    expect(ids).toEqual(["poster", "rhythm"]);
  });

  it("marks the eras card as public repositories only", () => {
    const eras = buildShareCards(dataFor()).find((card) => card.id === "eras");
    expect(eras?.notes).toContain("Public repositories only.");
    if (eras?.kind !== "eras") throw new Error("expected the eras card");
    expect(eras.repo).toBe("alpha");
    expect(eras.eras.map((era) => era.year)).toEqual(["2022", "2023", "2024"]);
  });

  it("builds only the poster in the lab, where there is no history", () => {
    expect(buildShareCards(labSceneData()).map((card) => card.id)).toEqual([
      "poster",
    ]);
  });
});
