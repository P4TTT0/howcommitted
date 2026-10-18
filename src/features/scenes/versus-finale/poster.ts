import { awardsFor } from "@/features/scenes/versus-awards/plan";
import type { VersusEntry } from "@/features/sequencer/types";
import {
  privateNoteFor,
  versusProfiles,
} from "@/features/versus/versusProfiles";
import { summarize } from "./summary";

export type PosterPerson = {
  login: string;
  /** Palette slot. */
  index: number;
  total: number;
  /** "1,234 contributions" */
  totalText: string;
  /** "2019 to 2024" */
  span: string;
  /** Award titles: habits, in the order they were handed out. */
  awards: string[];
};

export type PosterModel = {
  people: PosterPerson[];
  /** Sum of the calendar totals of everyone. */
  total: number;
  /** "Together, 2016 to 2026" */
  together: string;
  /** "Contributions between three of you." */
  sentence: string;
  /** Set when shared private contributions are part of the totals. */
  privateNote: string | null;
};

const COUNT_WORDS = ["zero", "one", "two", "three", "four", "five"] as const;

/**
 * The versus poster: one entry per developer in the order they were added,
 * with their calendar total, years and awards, plus the sum of everyone. Totals
 * and habits only: nothing here orders or compares the developers.
 */
export function buildPoster(entries: readonly VersusEntry[]): PosterModel {
  const summaries = summarize(entries);
  const profiles = versusProfiles(entries);
  const awards = awardsFor(profiles);
  const people = summaries.map<PosterPerson>((summary, index) => ({
    login: summary.login,
    index,
    total: summary.total,
    totalText: summary.totalText,
    span: summary.span,
    awards: awards
      .filter((award) => award.person === index)
      .map((award) => award.title),
  }));
  const total = people.reduce((sum, person) => sum + person.total, 0);

  const firsts = profiles.flatMap((p) => p.firstYear ?? []);
  const lasts = profiles.flatMap((p) => p.lastYear ?? []);
  const first = firsts.length > 0 ? Math.min(...firsts) : null;
  const last = lasts.length > 0 ? Math.max(...lasts) : null;
  let together = "Together";
  if (first !== null && last !== null) {
    together = `Together, ${first === last ? first : `${first} to ${last}`}`;
  }
  const count = COUNT_WORDS[people.length] ?? `${people.length}`;
  return {
    people,
    total,
    together,
    sentence: `Contributions between ${count} of you.`,
    privateNote: privateNoteFor(profiles),
  };
}
