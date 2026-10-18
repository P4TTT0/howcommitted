import { describe, expect, it } from "vitest";
import { ageYear, alignSameAge, yearStartOf } from "./same-age";

const day = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 86_400_000;

describe("yearStartOf", () => {
  it("returns January 1st of the year", () => {
    expect(yearStartOf(day("2024-07-19"))).toBe(day("2024-01-01"));
    expect(yearStartOf(day("2023-01-01"))).toBe(day("2023-01-01"));
  });
});

describe("alignSameAge", () => {
  it("anchors each series on the first day of its first contribution year", () => {
    const aligned = alignSameAge([
      {
        series: [0, 0, 1, 2, 3],
        startDay: day("2020-01-01"),
        firstDay: day("2020-01-03"),
      },
      {
        series: [0, 5, 6],
        startDay: day("2020-01-02"),
        firstDay: day("2020-01-03"),
      },
    ]);
    // The second series starts a day after its anchor: one zero is padded.
    expect(aligned.series[0]).toEqual([0, 0, 1, 2, 3]);
    expect(aligned.series[1]).toEqual([0, 0, 5, 6, 6]);
    expect(aligned.firstIndex).toEqual([2, 2]);
  });

  it("lines up a late starter with an early one by years since the first year", () => {
    const early = {
      series: Array.from({ length: 731 }, (_, i) => i),
      startDay: day("2010-01-01"),
      firstDay: day("2010-06-01"),
    };
    const late = {
      series: Array.from({ length: 366 }, () => 7),
      startDay: day("2020-01-01"),
      firstDay: day("2020-03-01"),
    };
    const aligned = alignSameAge([early, late]);
    expect(aligned.length).toBe(731);
    // Index 0 is each one's own January 1st.
    expect(aligned.series[0]?.[0]).toBe(0);
    expect(aligned.series[1]?.[0]).toBe(7);
    // The short series is held after its last day.
    expect(aligned.series[1]?.[730]).toBe(7);
    expect(aligned.firstIndex[0]).toBe(day("2010-06-01") - day("2010-01-01"));
    expect(aligned.firstIndex[1]).toBe(day("2020-03-01") - day("2020-01-01"));
  });

  it("keeps a developer without contributions at zero", () => {
    const aligned = alignSameAge([
      {
        series: [1, 2, 3],
        startDay: day("2021-01-01"),
        firstDay: day("2021-01-01"),
      },
      { series: [0, 0, 0], startDay: day("2021-01-01"), firstDay: null },
    ]);
    expect(aligned.series[1]).toEqual([0, 0, 0]);
    expect(aligned.firstIndex[1]).toBeNull();
  });

  it("never returns an empty axis", () => {
    expect(alignSameAge([]).length).toBe(1);
  });
});

describe("ageYear", () => {
  it("counts years from 1", () => {
    expect(ageYear(0)).toBe(1);
    expect(ageYear(364)).toBe(1);
    expect(ageYear(366)).toBe(2);
    expect(ageYear(1_000)).toBe(3);
  });
});
