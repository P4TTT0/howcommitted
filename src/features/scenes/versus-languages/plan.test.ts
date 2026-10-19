import { describe, expect, it } from "vitest";
import type { LanguageShare } from "@/domain/languages";
import type { VersusProfile } from "@/features/versus/versusProfiles";
import { planLanguages } from "./plan";

function profile(
  login: string,
  index: number,
  languages: [string, number][] | null,
): VersusProfile {
  const shares: LanguageShare[] | null = languages
    ? languages.map(([name, share]) => ({
        name,
        size: share * 1000,
        share,
        isOther: name === "Other",
      }))
    : null;
  return { login, index, languages: shares } as VersusProfile;
}

describe("planLanguages", () => {
  it("lists each developer's own shares in the order added", () => {
    const plan = planLanguages([
      profile("ada", 0, [
        ["TypeScript", 0.6],
        ["Other", 0.4],
      ]),
      profile("grace", 1, [["Python", 1]]),
    ]);
    expect(plan?.people.map((person) => person.login)).toEqual([
      "ada",
      "grace",
    ]);
    expect(plan?.people[0]?.top).toEqual({
      name: "TypeScript",
      percent: 60,
      isOther: false,
    });
  });

  it("never picks Other as the favorite", () => {
    const plan = planLanguages([
      profile("ada", 0, [["Other", 1]]),
      profile("g", 1, [["Go", 1]]),
    ]);
    expect(plan?.people[0]?.top).toBeNull();
  });

  it("notes a language everyone has and one only a single developer has", () => {
    const plan = planLanguages([
      profile("ada", 0, [
        ["TypeScript", 0.5],
        ["Go", 0.5],
      ]),
      profile("grace", 1, [
        ["TypeScript", 0.5],
        ["Python", 0.5],
      ]),
      profile("linus", 2, [
        ["TypeScript", 0.5],
        ["C", 0.5],
      ]),
    ]);
    expect(plan?.facts).toEqual([
      "TypeScript shows up for all 3.",
      "Only @ada has Go in their top languages.",
    ]);
  });

  it("says both for two developers", () => {
    const plan = planLanguages([
      profile("ada", 0, [["Go", 1]]),
      profile("grace", 1, [["Go", 1]]),
    ]);
    expect(plan?.facts).toEqual(["Go shows up for both."]);
  });

  it("is null when nobody has public code", () => {
    expect(
      planLanguages([profile("ada", 0, null), profile("g", 1, [])]),
    ).toBeNull();
  });
});
