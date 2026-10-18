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

  it("never calls the calendar commits or judges, in any string of any card", () => {
    const strings = (value: unknown): string[] =>
      typeof value === "string"
        ? [value]
        : Array.isArray(value)
          ? value.flatMap(strings)
          : value && typeof value === "object"
            ? Object.values(value).flatMap(strings)
            : [];
    for (const card of buildShareCards(dataFor())) {
      // Only the eras detail counts real commits, to public repositories.
      const own = card.kind === "eras" ? { ...card, detail: "" } : card;
      const text = strings(own).join(" | ");
      expect(text, card.id).not.toMatch(/\bcommits?\b/i);
      expect(text, card.id).not.toMatch(
        /best|winner|most productive|percentile/i,
      );
    }
    const eras = buildShareCards(dataFor()).find((c) => c.id === "eras");
    expect(eras?.kind === "eras" && eras.detail).toMatch(/public commits/);
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

  it("states the private share on the rhythm card too", () => {
    const years = [
      makeYear(2023, steadyDays(2023, 2, 2), { privateContributions: 40 }),
      makeYear(2024, steadyDays(2024, 2, 2)),
    ];
    const history = makeHistory("ada", years);
    const rhythm = buildShareCards({
      login: "ada",
      model: planFromHistory(history),
      history,
    }).find((card) => card.id === "rhythm");
    expect(rhythm?.notes).toContain("Includes 40 private contributions.");
  });

  it("uses the singular for a single contribution", () => {
    const history = makeHistory("ada", [
      makeYear(2024, [{ date: "2024-03-01", count: 1 }]),
    ]);
    const [poster] = buildShareCards({
      login: "ada",
      model: planFromHistory(history),
      history,
    });
    expect(poster?.kind === "poster" && poster.headline).toBe("Contribution.");
  });

  it("writes a single year as one year, not a range", () => {
    const data = dataFor();
    const history = makeHistory("ada", [
      makeYear(2024, steadyDays(2024, 2, 2)),
    ]);
    const [poster] = buildShareCards({
      ...data,
      model: planFromHistory(history),
      history,
    });
    expect(poster?.kind === "poster" && poster.range).toBe("2024");
  });

  it("leaves out the streak when there is none", () => {
    const [poster] = buildShareCards(
      dataFor({ longestStreak: { length: 0, start: null, end: null } }),
    );
    const facts = poster?.kind === "poster" ? poster.facts : [];
    expect(facts.map((fact) => fact.label)).not.toContain("Longest streak");
  });

  it("does not claim a language when only Other is known", () => {
    const [poster] = buildShareCards(
      dataFor({
        languages: [{ name: "Other", size: 10, share: 1, isOther: true }],
      }),
    );
    const facts = poster?.kind === "poster" ? poster.facts : [];
    expect(facts.map((fact) => fact.label)).not.toContain("Built with");
  });

  it("keeps a 39-character login whole in the filename and address", () => {
    const login = "a".repeat(39);
    const data = dataFor();
    const cards = buildShareCards({ ...data, login });
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card.filename).toBe(`committed-${login}-${card.id}`);
      expect(card.address).toBe(`howcommitted.com/${login}`);
    }
  });
});
