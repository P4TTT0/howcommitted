import { describe, expect, it } from "vitest";
import {
  MAX_REPO_FLAGS,
  NOTABLE_MIN_STARS,
  repoCreationFlags,
} from "./repo-flags";
import type { Repo } from "./types";

describe("repoCreationFlags", () => {
  const repo = (name: string, createdAt: string, stars: number): Repo => ({
    name,
    createdAt,
    stars,
    languages: [],
  });

  it("flags the first repo and notable ones, oldest first", () => {
    const flags = repoCreationFlags([
      repo("big", "2021-01-01T00:00:00Z", 500),
      repo("first", "2015-01-01T00:00:00Z", 0),
      repo("small", "2018-01-01T00:00:00Z", 2),
    ]);
    expect(flags.map((f) => [f.name, f.reason])).toEqual([
      ["first", "first"],
      ["big", "notable"],
    ]);
  });

  it("caps the number of flags keeping the most starred", () => {
    const repos = Array.from({ length: 20 }, (_, i) =>
      repo(`r${i}`, `20${String(10 + i)}-01-01T00:00:00Z`, 100 + i),
    );
    const flags = repoCreationFlags(repos);
    expect(flags).toHaveLength(MAX_REPO_FLAGS);
    expect(flags[0]?.name).toBe("r0");
    expect(flags.some((f) => f.name === "r19")).toBe(true);
  });

  it("returns nothing with a cap of zero and only the first repo with a cap of one", () => {
    const repos = [
      repo("first", "2015-01-01T00:00:00Z", 0),
      repo("big", "2021-01-01T00:00:00Z", 500),
    ];
    expect(repoCreationFlags(repos, 0)).toEqual([]);
    expect(repoCreationFlags(repos, 1).map((f) => f.name)).toEqual(["first"]);
  });

  it("includes repos at the star threshold and excludes those below", () => {
    const flags = repoCreationFlags([
      repo("first", "2015-01-01T00:00:00Z", 0),
      repo("below", "2016-01-01T00:00:00Z", NOTABLE_MIN_STARS - 1),
      repo("at", "2017-01-01T00:00:00Z", NOTABLE_MIN_STARS),
    ]);
    expect(flags.map((f) => f.name)).toEqual(["first", "at"]);
  });

  it("returns nothing for no repos", () => {
    expect(repoCreationFlags([])).toEqual([]);
  });
});
