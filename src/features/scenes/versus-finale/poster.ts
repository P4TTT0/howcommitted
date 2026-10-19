import { awardsFor } from "@/features/scenes/versus-awards/plan";
import { buildRace } from "@/features/scenes/versus-race/race";
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
  /** The same awards with the value each one names ("104 days in a row"). */
  awardDetails: { title: string; value: string }[];
};

export type PosterModel = {
  people: PosterPerson[];
  /** Sum of the calendar totals of everyone. */
  total: number;
  /** "Together, 2016 to 2026" */
  together: string;
  /** First and last calendar year of the lineup; null without any year. */
  years: { first: number; last: number } | null;
  /** Times one running total passed another in the race; 0 without a race. */
  passes: number;
  /** Set when shared private contributions are part of the totals. */
  privateNote: string | null;
  /** Shared private contributions inside the totals; 0 when nobody shared. */
  privateTotal: number;
};

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
    awardDetails: awards
      .filter((award) => award.person === index)
      .map((award) => ({ title: award.title, value: award.value })),
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
  const race = buildRace(
    entries.map(({ login, model }) => ({ login, plan: model.plan })),
  );
  return {
    people,
    total,
    together,
    years: first !== null && last !== null ? { first, last } : null,
    passes: race?.crossings.length ?? 0,
    privateNote: privateNoteFor(profiles),
    privateTotal: profiles.reduce(
      (sum, profile) => sum + profile.privateContributions,
      0,
    ),
  };
}
