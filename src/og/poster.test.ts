import { describe, expect, it } from "vitest";
import type { YearSummary } from "@/domain/types";
import { blocks } from "@/ui/tokens";
import {
  buildPosterModel,
  cachedDescription,
  FIXED_LINE,
  genericDescription,
  loginFontSize,
  pageTitle,
  privateLine,
} from "./poster";

const year = (y: number, total: number, priv = 0): YearSummary => ({
  year: y,
  totals: {
    commits: 0,
    pullRequests: 0,
    reviews: 0,
    issues: 0,
    privateContributions: priv,
  },
  dailyCommits: [],
  reconciliation: { summed: 0, official: 0, difference: 0, matches: true },
  calendar: [],
  totalContributions: total,
});

describe("buildPosterModel", () => {
  it("sums calendar totals and orders years oldest first", () => {
    const model = buildPosterModel({ login: "octo" }, [
      year(2024, 300, 40),
      year(2022, 100),
      year(2023, 200, 2),
    ]);
    expect(model?.totalContributions).toBe(600);
    expect(model?.privateContributions).toBe(42);
    expect(model?.bars.map((b) => b.year)).toEqual([2022, 2023, 2024]);
    expect([model?.firstYear, model?.lastYear]).toEqual([2022, 2024]);
  });

  it("scales bars to the tallest year and rotates the block palette", () => {
    const years = Array.from({ length: 7 }, (_, i) =>
      year(2018 + i, i === 3 ? 1000 : 500),
    );
    const model = buildPosterModel({ login: "octo" }, years);
    expect(model?.bars[3]?.ratio).toBe(1);
    expect(model?.bars[0]?.ratio).toBe(0.5);
    expect(model?.bars[0]?.color).toBe(blocks.ultramarine);
    expect(model?.bars[1]?.color).toBe(blocks.safety);
    expect(model?.bars[6]?.color).toBe(blocks.ultramarine);
  });

  it("keeps empty years visible and survives an all-zero history", () => {
    const model = buildPosterModel({ login: "octo" }, [
      year(2024, 0),
      year(2025, 0),
    ]);
    expect(model?.totalContributions).toBe(0);
    expect(model?.bars.every((b) => b.ratio > 0 && b.ratio <= 1)).toBe(true);
  });

  it("returns null without years", () => {
    expect(buildPosterModel({ login: "octo" }, [])).toBeNull();
  });
});

describe("copy", () => {
  it("states the private share only when it is above zero", () => {
    expect(privateLine(0)).toBeNull();
    expect(privateLine(1)).toBe("Includes 1 private contribution.");
    expect(privateLine(1912)).toBe("Includes 1,912 private contributions.");
  });

  it("describes totals as contributions, never commits, with the fixed line", () => {
    const model = buildPosterModel({ login: "octo" }, [
      year(2023, 1000, 5),
      year(2024, 2345),
    ]);
    if (!model) throw new Error("model expected");
    const text = cachedDescription(model);
    expect(text).toContain("3,345 contributions on GitHub, 2023 to 2024.");
    expect(text).toContain("Includes 5 private contributions.");
    expect(text).toContain(FIXED_LINE);
    expect(text.toLowerCase()).not.toContain("commits");
  });

  it("uses a single year and omits the private line when there is none", () => {
    const model = buildPosterModel({ login: "octo" }, [year(2024, 1)]);
    if (!model) throw new Error("model expected");
    const text = cachedDescription(model);
    expect(text).toContain("1 contribution on GitHub, 2024.");
    expect(text).not.toContain("private");
  });

  it("builds a numberless description and a title for unknown profiles", () => {
    expect(genericDescription("octo")).not.toMatch(/\d/);
    expect(pageTitle("octo")).toBe("@octo | Committed");
  });
});

describe("loginFontSize", () => {
  it("caps short logins and shrinks long ones to fit the width", () => {
    expect(loginFontSize("ab", 1088, 200)).toBe(200);
    const longest = "a".repeat(39);
    const size = loginFontSize(longest, 1088, 200);
    expect(size).toBeLessThan(200);
    expect(size * 0.5 * (longest.length + 4)).toBeLessThanOrEqual(1088);
  });
});
