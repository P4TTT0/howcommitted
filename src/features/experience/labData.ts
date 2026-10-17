import type { RepoFlag } from "@/domain/repo-flags";
import { generateFakeProfile } from "@/features/sequencer/model/fakeProfile";
import { buildPlan } from "@/features/sequencer/model/plan";
import type { SceneData } from "@/features/sequencer/types";

/**
 * The lab's scene data: the generated profile mapped like a real history, so
 * every scene can be previewed without GitHub. There is no full `History`
 * (`history: null`); scenes that need one must say so and skip themselves.
 */
export function labSceneData(): SceneData {
  const days = generateFakeProfile();
  const plan = buildPlan(days);

  // Lab only: the fake profile's `commits` stand in for contributions here.
  // This is not a contributions source; real data comes from the calendar.
  const byYear = new Map<number, number>();
  for (const day of days) {
    const year = Number(day.date.slice(0, 4));
    byYear.set(year, (byYear.get(year) ?? 0) + day.commits);
  }
  const yearBlocks = [...byYear]
    .map(([year, contributions]) => ({ year, contributions }))
    .sort((a, b) => a.year - b.year);

  // Lab only: invented repositories so the flags can be reviewed.
  const flagAt = (fraction: number, flag: Omit<RepoFlag, "createdAt">) => {
    const day = days[Math.floor(days.length * fraction)] ?? days[0];
    return { ...flag, createdAt: `${day?.date ?? "2020-01-01"}T09:00:00Z` };
  };
  const repoFlags: RepoFlag[] = [
    flagAt(0.02, { name: "hello-world", stars: 0, reason: "first" }),
    flagAt(0.35, { name: "lab-notable", stars: 240, reason: "notable" }),
    flagAt(0.7, { name: "lab-library", stars: 1200, reason: "notable" }),
  ];

  return {
    login: "lab",
    history: null,
    model: {
      plan,
      yearBlocks,
      firstYear: yearBlocks[0]?.year ?? null,
      lastYear: yearBlocks.at(-1)?.year ?? null,
      gaps: [],
      incompleteYears: [],
      note: null,
      privateContributions: 0,
      repoFlags,
    },
  };
}
