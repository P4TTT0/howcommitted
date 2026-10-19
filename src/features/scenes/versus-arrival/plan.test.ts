import { describe, expect, it } from "vitest";
import { planFromHistory } from "@/features/sequencer/model/historyPlan";
import type { VersusEntry } from "@/features/sequencer/types";
import {
  makeHistory,
  makeYear,
  steadyDays,
} from "@/test-support/historyFixture";
import { buildArrival, progressAt, segmentScales } from "./plan";

const today = new Date("2030-01-01T00:00:00Z");

function entry(login: string, years: number[], joinedAt?: string): VersusEntry {
  const history = makeHistory(
    login,
    years.map((year) => makeYear(year, steadyDays(year, 1))),
  );
  return { login, model: planFromHistory(history, today), joinedAt };
}

describe("buildArrival", () => {
  const arrival = buildArrival([
    entry("ada", [2016, 2017], "2012-03-02T10:00:00Z"),
    entry("grace", [2018], "2017-09-25T10:00:00Z"),
  ]);

  it("places everyone on one axis starting at the earliest year", () => {
    if (!arrival) throw new Error("arrival expected");
    const [ada, grace] = arrival.rows;
    expect(ada?.joinedAt).toBeGreaterThan(0);
    expect(ada?.joinedAt).toBeLessThan(ada?.firstAt ?? 0);
    expect(grace?.joinedAt).toBeGreaterThan(ada?.firstAt ?? 0);
    expect(arrival.ticks[0]).toEqual({ label: "2012", at: 0 });
  });

  it("labels the account and first contribution months", () => {
    const [ada, grace] = arrival?.rows ?? [];
    expect(ada?.joinedLabel).toBe("Mar 2012");
    expect(ada?.firstLabel).toBe("Jan 2016");
    expect(grace?.waitDays).toBe(
      Math.round((Date.UTC(2018, 0, 1) - Date.UTC(2017, 8, 25)) / 86_400_000),
    );
  });

  it("states who joined first and who waited the least, plainly", () => {
    expect(arrival?.sentences[0]).toBe("@ada got here first, in Mar 2012.");
    expect(arrival?.sentences[1]).toMatch(
      /^@grace started contributing 98 days after joining\.$/,
    );
    for (const sentence of arrival?.sentences ?? []) {
      expect(sentence).not.toMatch(/best|winner|most productive|leader/i);
    }
  });

  it("times one row after the other, then the sentences, then a tail", () => {
    if (!arrival) throw new Error("arrival expected");
    expect(arrival.rowStarts[1]).toBeGreaterThan(arrival.rowStarts[0] ?? 0);
    const firstSentence = arrival.sentenceTimes[0] ?? 0;
    expect(firstSentence).toBeGreaterThan(
      (arrival.rowStarts.at(-1) ?? 0) + arrival.rowSeconds,
    );
    expect(arrival.duration).toBeGreaterThan(
      (arrival.sentenceTimes.at(-1) ?? 0) + arrival.sentenceSeconds,
    );
  });

  it("skips the account sentences when joining dates are unknown", () => {
    const unknown = buildArrival([
      entry("ada", [2020]),
      entry("grace", [2021]),
    ]);
    expect(unknown?.sentences).toEqual([]);
    expect(unknown?.rows[0]?.joinedAt).toBeNull();
    expect(unknown?.rows[0]?.firstLabel).toBe("Jan 2020");
  });

  it("handles a developer with no contributions", () => {
    const quiet = buildArrival([
      entry("ada", [2020], "2019-05-05T00:00:00Z"),
      {
        login: "zed",
        model: planFromHistory(makeHistory("zed", []), today),
        joinedAt: "2021-02-02T00:00:00Z",
      },
    ]);
    expect(quiet?.rows[1]?.firstAt).toBeNull();
    expect(quiet?.rows[1]?.reading).toBe(
      "@zed joined GitHub in Feb 2021, no contributions yet",
    );
  });

  it("is null when there is nothing to place", () => {
    expect(
      buildArrival([
        { login: "zed", model: planFromHistory(makeHistory("zed", []), today) },
      ]),
    ).toBeNull();
  });
});

describe("progressAt", () => {
  it("runs 0 to 1, or jumps under reduced motion", () => {
    expect(progressAt(0, 1, 2, false)).toBe(0);
    expect(progressAt(2, 1, 2, false)).toBe(0.5);
    expect(progressAt(9, 1, 2, false)).toBe(1);
    expect(progressAt(0.9, 1, 2, true)).toBe(0);
    expect(progressAt(1, 1, 2, true)).toBe(1);
  });
});

describe("segmentScales", () => {
  it("draws the dashed wait first and the solid bar after it", () => {
    const row = { joinedAt: 0.2, firstAt: 0.6 };
    // Total 0.8: wait is 0.4 long, bar 0.4 long.
    expect(segmentScales(row, 0)).toEqual({ wait: 0, bar: 0 });
    expect(segmentScales(row, 0.25).wait).toBeCloseTo(0.5);
    expect(segmentScales(row, 0.25).bar).toBe(0);
    expect(segmentScales(row, 0.5).wait).toBe(1);
    expect(segmentScales(row, 0.5).bar).toBeCloseTo(0);
    expect(segmentScales(row, 1)).toEqual({ wait: 1, bar: 1 });
  });

  it("draws only a bar without an account date", () => {
    const row = { joinedAt: null, firstAt: 0.5 };
    expect(segmentScales(row, 0.5)).toEqual({ wait: 1, bar: 0.5 });
  });
});
