import { passesLabel } from "@/features/scenes/versus-race/race";
import { formatCount } from "@/features/sequencer/model/format";
import { FIXED_LINE } from "@/og/poster";
import { blocks, neutrals, versus } from "@/ui/tokens";
import type { PosterModel } from "./poster";

/** Versus share cards are 9:16, the size of a story. */
export const VERSUS_CARD_SIZE = { width: 1080, height: 1920 } as const;

const SWATCHES = [versus.p1, versus.p2, versus.p3, versus.p4, versus.p5];
/** Ink on Mustard and Sky, Paper on the rest (see features/versus/swatchText). */
const ON_SWATCH = [
  neutrals.paper,
  neutrals.paper,
  neutrals.ink,
  neutrals.paper,
  neutrals.ink,
];

/** The race bars end here at the longest, as a share of the plot width. */
export const RACE_LONGEST = 0.62;
/** The shortest bar, so a tiny total still draws something. */
const RACE_SHORTEST = 0.04;

export type CardPerson = {
  login: string;
  /** The initial drawn in a circle: remote avatars would taint the canvas. */
  initial: string;
  color: string;
  /** Text color that reads on `color`. */
  onColor: string;
  total: number;
  totalText: string;
};

type CardBase = {
  id: "together" | "race" | "habits";
  /** Short name on the picker. */
  label: string;
  /** Name of the saved file, without the extension. */
  filename: string;
  /** What the picture says, for assistive tech. */
  alt: string;
  background: string;
  foreground: string;
  /** "@a vs @b vs @c" */
  lineup: string;
  /** The honest scope of the card, ending with its fixed line. */
  notes: string[];
};

export type TogetherCard = CardBase & {
  kind: "together";
  /** "2013 — 2026", or "" without a year. */
  span: string;
  total: string;
  headline: string;
  bands: (CardPerson & {
    /** Share of the combined total (0..1); sets the band's height. */
    share: number;
    awards: string;
  })[];
};

export type RaceCard = CardBase & {
  kind: "race";
  headline: string;
  /** "2013 → 2026" */
  years: string;
  passes: string;
  /** Final totals, the largest first (ties in lineup order). */
  bars: (CardPerson & {
    /** Bar length as a share of the plot (0..RACE_LONGEST). */
    length: number;
  })[];
};

export type HabitsCard = CardBase & {
  kind: "habits";
  headline: string;
  rows: (CardPerson & { awards: { title: string; value: string }[] })[];
};

export type VersusCard = TogetherCard | RaceCard | HabitsCard;

function peopleOf(poster: PosterModel): CardPerson[] {
  return poster.people.map((person) => ({
    login: person.login,
    initial: person.login.charAt(0).toUpperCase(),
    color: SWATCHES[person.index % SWATCHES.length] as string,
    onColor: ON_SWATCH[person.index % ON_SWATCH.length] as string,
    total: person.total,
    totalText: formatCount(person.total),
  }));
}

/** "2013 — 2026", the single year, or "" when there is none. */
function spanOf(poster: PosterModel, joiner: string): string {
  if (!poster.years) return "";
  const { first, last } = poster.years;
  return first === last ? `${first}` : `${first}${joiner}${last}`;
}

/** The three cards of a versus lineup: the sum, the race and the habits. */
export function buildVersusCards(poster: PosterModel): VersusCard[] {
  const all = peopleOf(poster);
  const lineup = all.map((person) => `@${person.login}`).join(" vs ");
  const privateNote =
    poster.privateTotal > 0
      ? [`Includes ${formatCount(poster.privateTotal)} private contributions.`]
      : [];
  const slug = all.map((person) => person.login).join("-vs-");
  const sum = Math.max(1, poster.total);
  const longest = Math.max(1, ...all.map((person) => person.total));

  const together: TogetherCard = {
    kind: "together",
    id: "together",
    label: "Together",
    filename: `committed-${slug}-together`,
    alt: `${lineup}: ${formatCount(poster.total)} contributions, together.`,
    background: neutrals.ink,
    foreground: neutrals.paper,
    lineup,
    notes: [...privateNote, FIXED_LINE],
    span: spanOf(poster, " — "),
    total: formatCount(poster.total),
    headline: "Contributions, together.",
    bands: all.map((person, index) => ({
      ...person,
      share: person.total / sum,
      awards: (poster.people[index]?.awards ?? []).join(" · "),
    })),
  };

  const race: RaceCard = {
    kind: "race",
    id: "race",
    label: "Race",
    filename: `committed-${slug}-race`,
    alt: `${lineup}: final totals of the contribution race, ${passesLabel(poster.passes)}.`,
    background: neutrals.paper,
    foreground: neutrals.ink,
    lineup,
    notes: [
      ...privateNote,
      "Running total of contributions. Rhythm, not value.",
    ],
    headline: "The race.",
    years: spanOf(poster, " → "),
    passes: passesLabel(poster.passes),
    bars: all
      .map((person, index) => ({
        ...person,
        index,
        length: Math.max(
          RACE_SHORTEST,
          (person.total / longest) * RACE_LONGEST,
        ),
      }))
      .sort((a, b) => b.total - a.total || a.index - b.index)
      .map(({ index: _index, ...bar }) => bar),
  };

  const habits: HabitsCard = {
    kind: "habits",
    id: "habits",
    label: "Habits",
    filename: `committed-${slug}-habits`,
    alt: `${lineup}: the habits each developer was named for.`,
    background: blocks.signal,
    foreground: neutrals.ink,
    lineup,
    notes: [...privateNote, "Every award names a habit, not a score."],
    headline: "Our habits.",
    rows: all.map((person, index) => ({
      ...person,
      awards: poster.people[index]?.awardDetails ?? [],
    })),
  };

  return [together, race, habits];
}
