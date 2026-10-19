import { describe, expect, it } from "vitest";
import { planFromHistory } from "@/features/sequencer/model/historyPlan";
import { makeHistory, makeYear } from "@/test-support/historyFixture";
import { privateNoteFor, versusProfiles } from "./versusProfiles";

const entry = (login: string, privateContributions = 0) => {
  const history = makeHistory(login, [
    makeYear(
      2023,
      [
        { date: "2023-05-01", count: 2 },
        { date: "2023-05-02", count: 3 },
        { date: "2023-05-09", count: 1 },
      ],
      { privateContributions },
    ),
  ]);
  return { login, model: planFromHistory(history), history };
};

describe("versusProfiles", () => {
  it("derives habits from the daily calendar, in the order added", () => {
    const profiles = versusProfiles([entry("ada"), entry("grace")]);
    expect(profiles.map((p) => p.login)).toEqual(["ada", "grace"]);
    expect(profiles[0]?.records.longestStreak.length).toBe(2);
    expect(profiles[0]?.metrics.longestQuiet).toBe(6);
    expect(profiles[0]?.week.total).toBe(6);
  });

  it("keeps the same profiles for the same lineup", () => {
    const entries = [entry("ada")];
    expect(versusProfiles(entries)).toBe(versusProfiles(entries));
  });

  it("has no languages without the full history", () => {
    const { login, model } = entry("ada");
    expect(versusProfiles([{ login, model }])[0]?.languages).toBeNull();
  });
});

describe("privateNoteFor", () => {
  it("is null when nobody shared private contributions", () => {
    expect(privateNoteFor(versusProfiles([entry("ada")]))).toBeNull();
  });

  it("names who shared how many", () => {
    const profiles = versusProfiles([entry("ada", 1200), entry("grace")]);
    expect(privateNoteFor(profiles)).toBe(
      "Includes shared private contributions: @ada 1,200.",
    );
  });
});
