import type { SceneData } from "@/features/sequencer/types";
import { generateFakeProfile } from "@/features/timeline/fakeProfile";
import { buildPlan } from "@/features/timeline/plan";

/**
 * The lab's scene data: the generated profile mapped like a real history, so
 * every scene can be previewed without GitHub. There is no full `History`
 * (`history: null`); scenes that need one must say so and skip themselves.
 */
export function labSceneData(): SceneData {
  const days = generateFakeProfile();
  const plan = buildPlan(days);

  const byYear = new Map<number, number>();
  for (const day of days) {
    const year = Number(day.date.slice(0, 4));
    byYear.set(year, (byYear.get(year) ?? 0) + day.commits);
  }
  const yearBlocks = [...byYear]
    .map(([year, contributions]) => ({ year, contributions }))
    .sort((a, b) => a.year - b.year);

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
    },
  };
}
