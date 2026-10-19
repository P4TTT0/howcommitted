import { describe, expect, it } from "vitest";
import { records } from "@/domain/records";
import type { VersusProfile } from "@/features/versus/versusProfiles";
import {
  dayCount,
  GRID_SECONDS,
  planStreaks,
  rangeText,
  spanLevel,
  streakPops,
} from "./plan";

function profile(login: string, index: number, dates: string[]): VersusProfile {
  return {
    login,
    index,
    days: dates.map((date) => ({ date, count: 1 })),
    records: records(dates.map((date) => ({ date, count: 1 }))),
  } as VersusProfile;
}

describe("rangeText", () => {
  it("shows the year once inside one year", () => {
    expect(rangeText("2023-04-10", "2023-10-13")).toBe(
      "Apr 10 to Oct 13, 2023",
    );
  });

  it("shows both years across a year boundary", () => {
    expect(rangeText("2022-12-30", "2023-01-02")).toBe(
      "Dec 30, 2022 to Jan 2, 2023",
    );
  });

  it("shows a single day alone", () => {
    expect(rangeText("2023-04-10", "2023-04-10")).toBe("Apr 10, 2023");
  });
});

describe("dayCount", () => {
  it("is singular for one", () => {
    expect(dayCount(1)).toBe("1 day");
    expect(dayCount(1200)).toBe("1,200 days");
  });
});

describe("planStreaks", () => {
  const ada = profile("ada", 0, [
    "2023-01-01",
    "2023-01-02",
    "2023-01-03",
    "2023-01-10",
  ]);
  const grace = profile("grace", 1, ["2023-01-05", "2023-01-06", "2023-01-20"]);

  it("places runs and quiet stretches on one shared axis", () => {
    const plan = planStreaks([ada, grace]);
    expect(plan?.from).toBe("2023-01-01");
    expect(plan?.to).toBe("2023-01-20");
    expect(plan?.rows[0]?.streak).toMatchObject({ days: 3, left: 0 });
    expect(plan?.rows[0]?.quiet).toMatchObject({ days: 6 });
    // Jan 5 is the fifth day of a twenty day axis.
    expect(plan?.rows[1]?.streak?.left).toBeCloseTo(20);
  });

  it("names the single longest run, and nobody on a tie", () => {
    expect(planStreaks([ada, grace])?.callout).toBe(
      "@ada kept it going for 3 days in a row.",
    );
    const level = profile("linus", 2, [
      "2023-02-01",
      "2023-02-02",
      "2023-02-03",
    ]);
    expect(planStreaks([ada, level])?.callout).toBeNull();
  });

  it("draws each developer's months scaled to their own busiest one", () => {
    const busy = profile("busy", 0, ["2023-01-01", "2023-02-01", "2023-02-02"]);
    const bars = planStreaks([busy, ada])?.rows[0]?.months;
    expect(bars?.map((bar) => bar.month)).toEqual(["2023-01", "2023-02"]);
    expect(bars?.[1]?.level).toBe(1);
    expect(bars?.[0]?.level).toBeCloseTo(0.5);
    expect(bars?.[0]?.left).toBe(0);
  });

  it("is null when nobody has contributed", () => {
    expect(planStreaks([profile("ada", 0, [])])).toBeNull();
  });
});

describe("streakPops and spanLevel", () => {
  const plan = planStreaks([
    profile("ada", 0, ["2023-01-01", "2023-01-02", "2023-01-03", "2023-01-10"]),
    profile("bob", 1, ["2023-01-01", "2023-01-10"]),
  ]);

  it("pops a row, then its quiet block and its streak block, on the grid", () => {
    const pops = streakPops(plan ?? { rows: [] });
    const first = pops.filter((pop) => pop.row === 0);
    expect(first.map((pop) => pop.kind)).toEqual(["row", "quiet", "streak"]);
    expect(first[1]?.time).toBeCloseTo((first[0]?.time ?? 0) + GRID_SECONDS);
    expect(first[2]?.time).toBeCloseTo(
      (first[0]?.time ?? 0) + 2 * GRID_SECONDS,
    );
  });

  it("scales the hover level to the longest block", () => {
    const rows = plan?.rows ?? [];
    const longest = Math.max(
      ...rows.flatMap((row) => [row.streak?.days ?? 0, row.quiet?.days ?? 0]),
    );
    expect(spanLevel({ rows }, longest)).toBe(1);
    expect(spanLevel({ rows }, longest / 2)).toBe(0.5);
    expect(spanLevel({ rows: [] }, 3)).toBe(0);
  });
});
