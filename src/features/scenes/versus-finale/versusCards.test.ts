import { describe, expect, it } from "vitest";
import { FIXED_LINE } from "@/og/poster";
import type { PosterModel, PosterPerson } from "./poster";
import { buildVersusCards, RACE_LONGEST } from "./versusCards";

function person(
  login: string,
  index: number,
  total: number,
  awards: { title: string; value: string }[] = [],
): PosterPerson {
  return {
    login,
    index,
    total,
    totalText: `${total} contributions`,
    span: "2013 to 2026",
    awards: awards.map((award) => award.title),
    awardDetails: awards,
  };
}

function poster(overrides: Partial<PosterModel> = {}): PosterModel {
  const people = [
    person("ada", 0, 38_936, [
      { title: "Longest streak", value: "104 days in a row" },
      { title: "Active days", value: "5,224 days with a contribution" },
    ]),
    person("lin", 1, 78_359, [
      { title: "Reviewer", value: "3,669 code reviews" },
    ]),
    person("mo", 2, 15_156),
  ];
  return {
    people,
    total: 132_451,
    together: "Together, 2013 to 2026",
    years: { first: 2013, last: 2026 },
    passes: 7,
    privateNote: null,
    privateTotal: 0,
    ...overrides,
  };
}

describe("buildVersusCards", () => {
  it("builds together, race and habits in that order", () => {
    const cards = buildVersusCards(poster());
    expect(cards.map((card) => card.id)).toEqual([
      "together",
      "race",
      "habits",
    ]);
    expect(cards.map((card) => card.label)).toEqual([
      "Together",
      "Race",
      "Habits",
    ]);
    expect(new Set(cards.map((card) => card.filename)).size).toBe(3);
  });

  it("together: the sum, the span and one band per developer by share", () => {
    const [together] = buildVersusCards(poster());
    if (together?.kind !== "together") throw new Error("wrong card");
    expect(together.total).toBe("132,451");
    expect(together.span).toBe("2013 — 2026");
    expect(together.lineup).toBe("@ada vs @lin vs @mo");
    expect(together.headline).toBe("Contributions, together.");
    expect(together.bands.map((band) => band.login)).toEqual([
      "ada",
      "lin",
      "mo",
    ]);
    const shares = together.bands.reduce((sum, band) => sum + band.share, 0);
    expect(shares).toBeCloseTo(1);
    expect(together.bands[0]?.awards).toBe("Longest streak · Active days");
    expect(together.bands[0]?.initial).toBe("A");
    expect(together.notes.at(-1)).toBe(FIXED_LINE);
  });

  it("race: final totals largest first, ties in lineup order, with the passes", () => {
    const cards = buildVersusCards(
      poster({
        people: [
          person("ada", 0, 100),
          person("lin", 1, 400),
          person("mo", 2, 100),
        ],
        total: 600,
      }),
    );
    const race = cards[1];
    if (race?.kind !== "race") throw new Error("wrong card");
    expect(race.bars.map((bar) => bar.login)).toEqual(["lin", "ada", "mo"]);
    expect(race.bars[0]?.length).toBeCloseTo(RACE_LONGEST);
    expect(race.bars[1]?.length).toBeCloseTo(RACE_LONGEST / 4);
    expect(race.years).toBe("2013 → 2026");
    expect(race.passes).toBe("7 passes");
  });

  it("race: a tiny total still draws a bar and one pass is singular", () => {
    const cards = buildVersusCards(
      poster({
        people: [person("ada", 0, 1_000_000), person("lin", 1, 1)],
        total: 1_000_001,
        passes: 1,
      }),
    );
    const race = cards[1];
    if (race?.kind !== "race") throw new Error("wrong card");
    expect(race.bars[1]?.length).toBeGreaterThan(0);
    expect(race.passes).toBe("1 pass");
  });

  it("habits: each developer's awards with their values", () => {
    const habits = buildVersusCards(poster())[2];
    if (habits?.kind !== "habits") throw new Error("wrong card");
    expect(habits.rows[0]?.awards).toEqual([
      { title: "Longest streak", value: "104 days in a row" },
      { title: "Active days", value: "5,224 days with a contribution" },
    ]);
    expect(habits.rows[2]?.awards).toEqual([]);
  });

  it("states the shared private contributions on every card, only when there are", () => {
    const without = buildVersusCards(poster());
    for (const card of without) {
      expect(card.notes.join(" ")).not.toContain("private");
    }
    const withPrivate = buildVersusCards(poster({ privateTotal: 812 }));
    for (const card of withPrivate) {
      expect(card.notes[0]).toBe("Includes 812 private contributions.");
    }
  });

  it("uses one year, and no span at all, when the years are missing", () => {
    const one = buildVersusCards(
      poster({ years: { first: 2024, last: 2024 } }),
    );
    if (one[0]?.kind !== "together") throw new Error("wrong card");
    expect(one[0].span).toBe("2024");
    const none = buildVersusCards(poster({ years: null }));
    if (none[0]?.kind !== "together") throw new Error("wrong card");
    expect(none[0].span).toBe("");
  });

  it("never judges in the copy it draws", () => {
    const text = JSON.stringify(buildVersusCards(poster()));
    expect(text).not.toMatch(/winner|best|most productive|leader|champion/i);
  });
});
