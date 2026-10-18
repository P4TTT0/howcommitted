import type { LanguageShare } from "@/domain/languages";
import { type Records, records } from "@/domain/records";
import { type Rhythm, rhythm } from "@/domain/rhythm";
import type { DailyContributions } from "@/domain/types";
import type { AwardMetrics } from "@/domain/versus-awards";
import { peakWeekday } from "@/domain/versus-rhythm";
import { type WeekShape, weekShape } from "@/domain/week-shape";
import type { VersusEntry } from "@/features/sequencer/types";

/** What the versus scenes 4 to 8 read about one developer, derived once. */
export type VersusProfile = {
  login: string;
  /** Position in the lineup; also the palette slot. */
  index: number;
  /** Days with at least one contribution (calendar, all types). */
  days: DailyContributions[];
  total: number;
  firstYear: number | null;
  lastYear: number | null;
  records: Records;
  week: WeekShape;
  rhythm: Rhythm;
  /** Null when the full history is not known. Empty when there is no public code. */
  languages: LanguageShare[] | null;
  metrics: AwardMetrics;
  /** Shared private contributions inside the calendar days (a count only). */
  privateContributions: number;
};

function profileOf(entry: VersusEntry, index: number): VersusProfile {
  const { login, model, history } = entry;
  const days = model.plan.days
    .filter((day) => day.commits > 0)
    .map((day) => ({ date: day.date, count: day.commits }));
  const habit = records(days);
  const week = weekShape(days);
  return {
    login,
    index,
    days,
    total: model.plan.total,
    firstYear: model.firstYear,
    lastYear: model.lastYear,
    records: habit,
    week,
    rhythm: rhythm(days),
    privateContributions: model.privateContributions,
    languages: history ? history.languages : null,
    metrics: {
      longestStreak: habit.longestStreak.length,
      firstYear: habit.firstDate ? Number(habit.firstDate.slice(0, 4)) : null,
      weekendShare: week.weekendShare,
      monThuShare: week.monThuShare,
      busiestDay: habit.busiestDay?.count ?? 0,
      longestQuiet: habit.longestQuiet?.length ?? 0,
      activeDays: habit.activeDays,
      activeYears: model.yearBlocks.filter((block) => block.contributions > 0)
        .length,
      busiestYear: habit.busiestYear?.count ?? 0,
      averagePerActiveDay: habit.averagePerActiveDay,
      favoriteWeekday: peakWeekday(week.weekdays),
      reviews: history ? history.totals.reviews : null,
      pullRequests: history ? history.totals.pullRequests : null,
    },
  };
}

const cache = new WeakMap<readonly VersusEntry[], VersusProfile[]>();

/**
 * One profile per developer, in the order they were added. Cached per lineup,
 * since the scenes and the poster all read the same ones.
 */
export function versusProfiles(
  entries: readonly VersusEntry[],
): VersusProfile[] {
  const cached = cache.get(entries);
  if (cached) return cached;
  const profiles = entries.map(profileOf);
  cache.set(entries, profiles);
  return profiles;
}

/**
 * The honest note for anything built from the daily series: it includes the
 * private contributions people chose to share. Null when nobody shared any.
 */
export function privateNoteFor(
  profiles: readonly Pick<VersusProfile, "login" | "privateContributions">[],
): string | null {
  const sharing = profiles.filter(
    (profile) => profile.privateContributions > 0,
  );
  if (sharing.length === 0) return null;
  const who = sharing
    .map(
      (profile) =>
        `@${profile.login} ${profile.privateContributions.toLocaleString("en-US")}`,
    )
    .join(", ");
  return `Includes shared private contributions: ${who}.`;
}
