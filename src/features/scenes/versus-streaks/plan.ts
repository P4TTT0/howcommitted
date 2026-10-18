import { daysBetween } from "@/domain/activity";
import {
  privateNoteFor,
  type VersusProfile,
} from "@/features/versus/versusProfiles";

/** A stretch of days placed on the shared axis, as percentages of its width. */
export type Span = {
  days: number;
  start: string;
  end: string;
  left: number;
  width: number;
};

export type StreakRow = {
  login: string;
  index: number;
  streak: Span | null;
  quiet: Span | null;
};

export type StreaksPlan = {
  rows: StreakRow[];
  /** First day of each calendar year on the axis, with its position. */
  years: { year: number; left: number }[];
  from: string;
  to: string;
  /** The single longest run, or null when two developers are level. */
  callout: string | null;
  /** Set when shared private contributions are part of the days. */
  privateNote: string | null;
};

const dayFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const dayYearFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const at = (date: string) => new Date(`${date}T00:00:00Z`);

/** "Apr 10 to Oct 13, 2023", or with both years when the stretch crosses one. */
export function rangeText(start: string, end: string): string {
  if (start === end) return dayYearFormat.format(at(start));
  if (start.slice(0, 4) === end.slice(0, 4)) {
    return `${dayFormat.format(at(start))} to ${dayYearFormat.format(at(end))}`;
  }
  return `${dayYearFormat.format(at(start))} to ${dayYearFormat.format(at(end))}`;
}

export function dayCount(n: number): string {
  return `${n.toLocaleString("en-US")} ${n === 1 ? "day" : "days"}`;
}

/**
 * Each developer's longest run of days in a row and longest quiet stretch,
 * on one axis shared by the whole lineup, in the order they were added. Calendar
 * contributions of every type, never commits. Null when nobody has a run.
 */
export function planStreaks(
  profiles: readonly VersusProfile[],
): StreaksPlan | null {
  const firsts = profiles.flatMap((p) => p.records.firstDate ?? []);
  const lasts = profiles.flatMap((p) => p.records.lastDate ?? []);
  const from = [...firsts].sort()[0];
  const to = [...lasts].sort().at(-1);
  if (!from || !to) return null;
  const length = Math.max(1, daysBetween(from, to) + 1);

  const place = (days: number, start: string, end: string): Span => ({
    days,
    start,
    end,
    left: (daysBetween(from, start) / length) * 100,
    width: ((daysBetween(start, end) + 1) / length) * 100,
  });

  const rows = profiles.map<StreakRow>((profile) => {
    const { longestStreak, longestQuiet } = profile.records;
    return {
      login: profile.login,
      index: profile.index,
      streak:
        longestStreak.length > 0 && longestStreak.start && longestStreak.end
          ? place(longestStreak.length, longestStreak.start, longestStreak.end)
          : null,
      quiet: longestQuiet
        ? place(longestQuiet.length, longestQuiet.start, longestQuiet.end)
        : null,
    };
  });
  if (rows.every((row) => row.streak === null)) return null;

  const years: StreaksPlan["years"] = [];
  const lastYear = Number(to.slice(0, 4));
  for (let year = Number(from.slice(0, 4)); year <= lastYear; year += 1) {
    const start = year === Number(from.slice(0, 4)) ? from : `${year}-01-01`;
    years.push({ year, left: (daysBetween(from, start) / length) * 100 });
  }

  const longest = Math.max(...rows.map((row) => row.streak?.days ?? 0));
  const holders = rows.filter((row) => row.streak?.days === longest);
  const holder = holders.length === 1 ? holders[0] : undefined;
  const callout =
    holder?.streak && profiles.length > 1
      ? `@${holder.login} kept it going for ${dayCount(longest)} in a row.`
      : null;

  return {
    rows,
    years,
    from,
    to,
    callout,
    privateNote: privateNoteFor(profiles),
  };
}
