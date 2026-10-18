import { describe, expect, it } from "vitest";
import {
  AWARD_COUNT,
  type AwardMetrics,
  awardsPerPerson,
  buildAwards,
} from "./versus-awards";

const base: AwardMetrics = {
  longestStreak: 10,
  firstYear: 2020,
  weekendShare: 0.2,
  monThuShare: 0.6,
  busiestDay: 5,
  longestQuiet: 20,
  activeDays: 100,
  activeYears: 4,
  busiestYear: 300,
  averagePerActiveDay: 2,
  favoriteWeekday: 1,
  reviews: null,
  pullRequests: null,
};

const person = (overrides: Partial<AwardMetrics>): AwardMetrics => ({
  ...base,
  ...overrides,
});

describe("buildAwards", () => {
  it("gives the streak award to the one with the longest streak", () => {
    const awards = buildAwards(
      [person({ longestStreak: 187 }), person({ longestStreak: 40 })],
      1,
    );
    expect(awards[0]).toMatchObject({
      id: "streak",
      title: "Longest streak",
      value: "187 days",
      person: 0,
    });
  });

  it("names nobody on a tie", () => {
    const awards = buildAwards(
      [person({ longestStreak: 12 }), person({ longestStreak: 12 })],
      3,
    );
    expect(awards.find((award) => award.id === "streak")).toBeUndefined();
  });

  it("gives the earliest start to the earliest first year", () => {
    const awards = buildAwards(
      [person({ firstYear: 2021 }), person({ firstYear: 2016 })],
      3,
    );
    expect(awards.find((award) => award.id === "earliest-start")).toMatchObject(
      { value: "2016", person: 1 },
    );
  });

  it("only names a weekend regular who spends the weekend there", () => {
    const none = buildAwards([person({ weekendShare: 0.3 }), person({})], 3);
    expect(none.find((award) => award.id === "weekend")).toBeUndefined();
    const some = buildAwards([person({ weekendShare: 0.4 }), person({})], 3);
    expect(some.find((award) => award.id === "weekend")).toMatchObject({
      value: "40%",
      person: 0,
    });
  });

  it("skips awards the history cannot back up", () => {
    const awards = buildAwards([person({}), person({})], 5);
    expect(awards.some((award) => award.id === "reviews")).toBe(false);
    const withReviews = buildAwards(
      [person({ reviews: 238 }), person({ reviews: 12 })],
      5,
    );
    expect(withReviews.find((award) => award.id === "reviews")).toMatchObject({
      value: "238",
      person: 0,
    });
  });

  it("caps each developer and keeps them grouped in the order added", () => {
    const awards = buildAwards(
      [
        person({
          longestStreak: 90,
          busiestDay: 50,
          activeDays: 900,
          busiestYear: 4000,
        }),
        person({ longestQuiet: 200, firstYear: 2012 }),
      ],
      2,
    );
    expect(awards.filter((award) => award.person === 0)).toHaveLength(2);
    expect(awards.map((award) => award.person)).toEqual(
      [...awards.map((award) => award.person)].sort(),
    );
  });

  it("gives everyone one before anyone gets a second", () => {
    const awards = buildAwards(
      [
        person({
          longestStreak: 90,
          busiestDay: 50,
          activeDays: 900,
          busiestYear: 4000,
        }),
        person({ longestQuiet: 200 }),
      ],
      1,
    );
    expect(awards.map((award) => award.person)).toEqual([0, 1]);
  });

  it("falls back to the favorite weekday for someone who stands out nowhere", () => {
    const awards = buildAwards([person({}), person({})], 3);
    expect(awards).toHaveLength(2);
    expect(awards[0]).toMatchObject({
      id: "favorite-weekday",
      value: "Tuesday",
      person: 0,
    });
  });

  it("gives nothing to someone without activity", () => {
    const awards = buildAwards(
      [person({ favoriteWeekday: null, longestStreak: 0 }), person({})],
      3,
    );
    expect(awards.some((award) => award.person === 0)).toBe(false);
  });

  it("never uses ranking or value words", () => {
    const awards = buildAwards(
      [
        person({
          longestStreak: 90,
          firstYear: 2010,
          weekendShare: 0.5,
          reviews: 9,
          busiestDay: 50,
          longestQuiet: 300,
          pullRequests: 7,
          activeDays: 900,
          busiestYear: 4000,
          activeYears: 12,
          averagePerActiveDay: 9,
        }),
        person({ monThuShare: 0.9 }),
      ],
      12,
    );
    const copy = awards
      .map((award) => `${award.title} ${award.metric}`)
      .join(" ");
    expect(copy).not.toMatch(/winner|best|top|leader|most productive|rank/i);
  });

  it("knows how many awards exist", () => {
    expect(AWARD_COUNT).toBe(12);
  });
});

describe("awardsPerPerson", () => {
  it("keeps the whole page at eight awards or fewer", () => {
    for (const people of [2, 3, 4, 5]) {
      expect(awardsPerPerson(people) * people).toBeLessThanOrEqual(8);
    }
  });
});
