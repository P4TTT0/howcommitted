import { describe, expect, it } from "vitest";
import { yearReading } from "./explore";

describe("yearReading", () => {
  it("names the year and its calendar contributions, never commits", () => {
    expect(yearReading({ year: 2021, contributions: 4924 })).toBe(
      "2021: 4,924 contributions",
    );
    expect(yearReading({ year: 2019, contributions: 0 })).toBe(
      "2019: 0 contributions",
    );
  });
});
