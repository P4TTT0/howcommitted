import type { DailyCommits } from "@/playback/aggregate";

/**
 * Deterministic fake commit history for the playback lab. It exists only to
 * exercise the playback engine; real data comes from the GitHub pipeline.
 */

const FIRST_DAY = Date.UTC(2018, 0, 1);
const YEARS = 8;
/** Average commits per working day, per year. Shapes the curve. */
const YEARLY_PACE = [1.8, 2.8, 4.0, 3.4, 5.6, 6.4, 4.6, 5.8] as const;

/** Small seeded PRNG (mulberry32). Same seed, same sequence. */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateFakeProfile(seed = 2026): DailyCommits[] {
  const random = createRandom(seed);
  const days: DailyCommits[] = [];
  const end = Date.UTC(2018 + YEARS, 0, 1);
  let quietDaysLeft = 0;

  for (let time = FIRST_DAY; time < end; time += 86_400_000) {
    const date = new Date(time);
    const year = date.getUTCFullYear() - 2018;
    const weekday = date.getUTCDay();
    const weekend = weekday === 0 || weekday === 6;

    // Occasional breaks (holidays, burnout, other projects) end a streak.
    if (quietDaysLeft === 0 && random() < 0.006) {
      quietDaysLeft = 10 + Math.floor(random() * 25);
    }
    let count = 0;
    if (quietDaysLeft > 0) {
      quietDaysLeft -= 1;
    } else {
      const pace = (YEARLY_PACE[year] ?? 2) * (weekend ? 0.25 : 1);
      // Squaring skews toward small days with the odd big one.
      const burst = random() ** 2 * 2.6 + 0.15;
      count = random() < (weekend ? 0.35 : 0.85) ? Math.round(pace * burst) : 0;
    }
    days.push({ date: date.toISOString().slice(0, 10), count });
  }
  return days;
}
