import type { RepoFlag } from "@/domain/repo-flags";
import { formatCount } from "@/features/sequencer/model/format";

/** A repo-creation flag placed on the line. */
export type FlagMark = {
  name: string;
  stars: number;
  /** Day the repository was created, `YYYY-MM-DD`. */
  date: string;
  /** Index of the day it sits on (clamped into the drawn range). */
  dayIndex: number;
  /** 0..1 along the line, at the end of that day like every other point. */
  progress: number;
};

/** "Mar 4, 2021" from an ISO day, independent of the viewer's time zone. */
export function formatDay(date: string): string {
  const parsed = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Places repo flags on the days of the line. A repository created before the
 * first drawn day sits at the start, one after the last at the end; the label
 * still carries its real date.
 */
export function flagMarks(
  flags: readonly RepoFlag[],
  days: readonly { date: string }[],
): FlagMark[] {
  if (days.length === 0) return [];
  return flags.map((flag) => {
    const date = flag.createdAt.slice(0, 10);
    const found = days.findIndex((day) => day.date >= date);
    const dayIndex = found === -1 ? days.length - 1 : found;
    return {
      name: flag.name,
      stars: flag.stars,
      date,
      dayIndex,
      progress: (dayIndex + 1) / days.length,
    };
  });
}

/** "Repository created: name, 240 stars, Mar 4, 2021". */
export function flagLabel(mark: FlagMark): string {
  const stars =
    mark.stars > 0
      ? `, ${formatCount(mark.stars)} ${mark.stars === 1 ? "star" : "stars"}`
      : "";
  return `Repository created: ${mark.name}${stars}, ${formatDay(mark.date)}`;
}
