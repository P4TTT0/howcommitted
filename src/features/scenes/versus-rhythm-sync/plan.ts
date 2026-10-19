import {
  peakWeekday,
  type RhythmPair,
  rhythmPairs,
  weekdayShares,
} from "@/domain/versus-rhythm";
import {
  privateNoteFor,
  type VersusProfile,
} from "@/features/versus/versusProfiles";

export const SHORT_DAYS = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
] as const;
export const LONG_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export type SyncPerson = {
  login: string;
  index: number;
  /** Share of this developer's contributions per weekday, Monday first, 0..1. */
  shares: number[];
  /** The same shares as whole percents. */
  percents: number[];
};

export type SyncCard = {
  label: string;
  /** "@ada + @grace" */
  names: string;
  /** "87% overlap. Both peak on Tuesday." */
  detail: string;
};

export type SyncPlan = {
  people: SyncPerson[];
  /** Largest share on the chart: the bars' common scale. */
  scale: number;
  cards: SyncCard[];
  /** Set when shared private contributions are part of the days. */
  privateNote: string | null;
};

function peakLine(a: VersusProfile, b: VersusProfile): string {
  const peakA = peakWeekday(a.week.weekdays);
  const peakB = peakWeekday(b.week.weekdays);
  if (peakA === null || peakB === null) return "";
  if (peakA === peakB) return `Both peak on ${LONG_DAYS[peakA]}.`;
  return `@${a.login} peaks on ${SHORT_DAYS[peakA]}, @${b.login} on ${SHORT_DAYS[peakB]}.`;
}

function card(
  label: string,
  pair: RhythmPair,
  profiles: readonly VersusProfile[],
): SyncCard | null {
  const a = profiles[pair.a];
  const b = profiles[pair.b];
  if (!a || !b) return null;
  return {
    label,
    names: `@${a.login} + @${b.login}`,
    detail:
      `${Math.round(pair.overlap * 100)}% overlap. ${peakLine(a, b)}`.trim(),
  };
}

/**
 * The seven weekdays of every developer side by side, each as a share of their
 * own contributions, plus the two pairs whose weeks overlap most and least.
 * Null when fewer than two developers have any activity.
 */
export function planRhythmSync(
  profiles: readonly VersusProfile[],
): SyncPlan | null {
  const active = profiles.filter((profile) => profile.week.total > 0);
  if (active.length < 2) return null;

  const people = profiles.map<SyncPerson>((profile) => {
    const shares = weekdayShares(profile.week.weekdays);
    return {
      login: profile.login,
      index: profile.index,
      shares,
      percents: shares.map((share) => Math.round(share * 100)),
    };
  });
  const scale = Math.max(...people.flatMap((person) => person.shares), 0.01);

  const { closest, furthest } = rhythmPairs(
    profiles.map((profile) => profile.week.weekdays),
  );
  const cards: SyncCard[] = [];
  if (closest) {
    const only = furthest === null && profiles.length === 2;
    const built = card(
      only ? "Weeks overlap" : "Closest weeks",
      closest,
      profiles,
    );
    if (built) cards.push(built);
  }
  if (furthest) {
    const built = card("Furthest apart", furthest, profiles);
    if (built) cards.push(built);
  }
  return { people, scale, cards, privateNote: privateNoteFor(profiles) };
}
