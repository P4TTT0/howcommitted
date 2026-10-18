import type { History } from "@/domain/history";
import { type Records, records } from "@/domain/records";
import { planMainRepo } from "@/features/scenes/main-repo/plan";
import { planWeekShape } from "@/features/scenes/week-shape/plan";
import { formatCount } from "@/features/sequencer/model/format";
import { blockForYearIndex } from "@/features/sequencer/model/plan";
import type { SceneData } from "@/features/sequencer/types";
import { blocks, neutrals } from "@/ui/tokens";
import { FIXED_LINE, privateNote, yearBars } from "./poster";

/** Share cards are 9:16, the size of a story. */
export const CARD_SIZE = { width: 1080, height: 1920 } as const;

export type CardFact = { label: string; value: string };

type CardBase = {
  id: "poster" | "rhythm" | "eras";
  /** Short name on the picker. */
  label: string;
  /** Name of the saved file, without the extension. */
  filename: string;
  /** What the picture says, for assistive tech. */
  alt: string;
  login: string;
  /** "howcommitted.com/login". */
  address: string;
  background: string;
  foreground: string;
  /** Second color for highlights, readable on `background`. */
  accent: string;
  /** The fixed line, plus the honest scope of the card. */
  notes: string[];
};

export type PosterCard = CardBase & {
  kind: "poster";
  range: string;
  total: string;
  headline: string;
  bars: { ratio: number; color: string }[];
  facts: CardFact[];
};

export type RhythmCard = CardBase & {
  kind: "rhythm";
  kicker: string;
  archetype: string;
  days: { short: string; ratio: number; weekend: boolean }[];
  facts: CardFact[];
};

export type ErasCard = CardBase & {
  kind: "eras";
  kicker: string;
  repo: string;
  detail: string;
  heading: string;
  eras: { year: string; repo: string; language: string; color: string }[];
};

export type ShareCard = PosterCard | RhythmCard | ErasCard;

const plural = (count: number, one: string, many: string) =>
  `${formatCount(count)} ${count === 1 ? one : many}`;

/** Bar colors for the poster card; they all read on the Ultramarine ground. */
const POSTER_BARS = [neutrals.paper, blocks.signal, blocks.pink, blocks.safety];

/** The honest private share as a card note list: empty when there is none. */
function privateExtra(privateContributions: number): string[] {
  const note = privateNote(privateContributions);
  return note ? [note] : [];
}

function base(
  data: SceneData,
  id: CardBase["id"],
  label: string,
  look: Pick<CardBase, "background" | "foreground" | "accent">,
  alt: string,
  extraNotes: string[] = [],
): CardBase {
  return {
    id,
    label,
    filename: `committed-${data.login}-${id}`,
    alt,
    login: data.login,
    address: `howcommitted.com/${data.login}`,
    ...look,
    notes: [...extraNotes, FIXED_LINE],
  };
}

/** "Longest streak: 12 days", or null when there is none to state. */
function streakFact(history: History): CardFact | null {
  const length = history.longestStreak.length;
  return length > 0
    ? { label: "Longest streak", value: plural(length, "day", "days") }
    : null;
}

function posterCard(data: SceneData, found: Records | null): PosterCard | null {
  const { model, history } = data;
  const { firstYear, lastYear } = model;
  if (firstYear === null || lastYear === null) return null;

  const bars = yearBars(
    firstYear,
    lastYear,
    new Map(model.yearBlocks.map((b) => [b.year, b.contributions])),
  ).map((bar, index) => ({
    ratio: bar.ratio,
    color: POSTER_BARS[index % POSTER_BARS.length] ?? neutrals.paper,
  }));

  const facts: CardFact[] = [];
  if (history) {
    const streak = streakFact(history);
    if (streak) facts.push(streak);
    if (found?.busiestDay) {
      facts.push({
        label: "Busiest day",
        value: formatCount(found.busiestDay.count),
      });
    }
    const language = history.languages.find((entry) => !entry.isOther);
    if (language) facts.push({ label: "Built with", value: language.name });
  }

  const range =
    firstYear === lastYear ? `${firstYear}` : `${firstYear} — ${lastYear}`;
  const total = formatCount(model.plan.total);
  return {
    ...base(
      data,
      "poster",
      "Poster",
      {
        background: blocks.ultramarine,
        foreground: neutrals.paper,
        accent: blocks.signal,
      },
      `Poster card for @${data.login}: ${total} contributions, ${range}.`,
      privateExtra(model.privateContributions),
    ),
    kind: "poster",
    range,
    total,
    headline: model.plan.total === 1 ? "Contribution." : "Contributions.",
    bars,
    facts,
  };
}

function rhythmCard(data: SceneData, found: Records | null): RhythmCard | null {
  if (!data.history || !found) return null;
  const week = planWeekShape(data.history);
  if (!week) return null;

  const facts: CardFact[] = [];
  const streak = streakFact(data.history);
  if (streak) facts.push(streak);
  if (found.longestQuiet) {
    facts.push({
      label: "Came back after",
      value: plural(found.longestQuiet.length, "day", "days"),
    });
  }
  return {
    ...base(
      data,
      "rhythm",
      "Rhythm",
      {
        background: blocks.forest,
        foreground: neutrals.paper,
        accent: blocks.signal,
      },
      `Rhythm card for @${data.login}: ${week.archetype}.`,
      // The streak, weekdays and quiet stretch come from the calendar, which
      // includes shared private contributions: say so, as the poster does.
      privateExtra(data.model.privateContributions),
    ),
    kind: "rhythm",
    kicker: "My rhythm",
    archetype: week.archetype,
    days: week.bars.map((bar) => ({
      short: bar.short,
      ratio: bar.ratio,
      weekend: bar.weekend,
    })),
    facts,
  };
}

function erasCard(data: SceneData): ErasCard | null {
  if (!data.history) return null;
  const main = planMainRepo(data.history, data.model.firstYear);
  if (!main) return null;
  const baseYear = data.model.firstYear ?? main.eras[0]?.year ?? 0;
  return {
    ...base(
      data,
      "eras",
      "Eras",
      {
        background: blocks.safety,
        foreground: neutrals.ink,
        accent: neutrals.ink,
      },
      `Eras card for @${data.login}: the repository they kept coming back to is ${main.name}.`,
      ["Public repositories only."],
    ),
    kind: "eras",
    kicker: "The one I kept coming back to",
    repo: main.name,
    detail: `${plural(main.repo.commits, "public commit", "public commits")} · ${main.span.replace(" to ", " — ")}`,
    heading: "My eras",
    eras: main.eras.map((era) => ({
      year: String(era.year),
      repo: era.name,
      language: era.language ?? "",
      color: blockForYearIndex(era.year - baseYear).background,
    })),
  };
}

/**
 * The cards that can be built from this data, in picker order. A card whose
 * data is missing (no weekly rhythm, no public repository, the lab) is left
 * out, never filled with placeholders. Built from the history already in the
 * browser: nothing here is fetched, stored or cached.
 */
export function buildShareCards(data: SceneData): ShareCard[] {
  const found = data.history
    ? records(data.history.years.flatMap((year) => year.dailyContributions))
    : null;
  return [
    posterCard(data, found),
    rhythmCard(data, found),
    erasCard(data),
  ].filter((card): card is ShareCard => card !== null);
}

const built = new WeakMap<object, ShareCard[]>();

/**
 * `buildShareCards`, once per plan: the finale renders again for unrelated
 * reasons, and the picker must keep receiving the same array to avoid
 * redrawing its canvases.
 */
export function shareCardsFor(data: SceneData): ShareCard[] {
  const known = built.get(data.model);
  if (known) return known;
  const cards = buildShareCards(data);
  built.set(data.model, cards);
  return cards;
}
