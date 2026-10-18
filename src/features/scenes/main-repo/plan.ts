import type { History } from "@/domain/history";
import { eras, type MainRepo, mainRepo, topRepos } from "@/domain/repo-eras";
import { formatCount } from "@/features/sequencer/model/format";
import {
  BLOCK_SEQUENCE,
  blockForYearIndex,
} from "@/features/sequencer/model/plan";
import { quantizeUp } from "@/playback/schedule";
import { neutrals } from "@/ui/tokens";

export const BPM = 120;
/** One sixteenth note at the tempo. */
export const GRID_SECONDS = 60 / BPM / 4;
const LEAD_SECONDS = 0.4;
/** Seconds the repo name takes to slam in. */
export const SLAM_SECONDS = 0.3;
const BAR_STEP_SECONDS = GRID_SECONDS * 2;
/** Seconds one bar takes to grow. */
export const BAR_SECONDS = 0.5;
const ERA_STEP_SECONDS = GRID_SECONDS * 2;
/** Seconds one era tile takes to flip in. */
export const FLIP_SECONDS = 0.4;
const TAIL_SECONDS = 1.6;
const MIN_SECONDS = 4;
/** At most this many eras are shown: the most recent years. */
export const MAX_ERAS = 8;
/** Names up to this long fit the giant type at full size. */
const FULL_SIZE_NAME = 9;
export const MIN_NAME_SCALE = 0.35;
/** Highest scale degree the ticks reach (see playback/pitch). */
const MAX_DEGREE = 10;

/** The main repo's block uses the orange pair of the shared palette. */
const BLOCK_COLORS = BLOCK_SEQUENCE[1];

export type RepoBar = {
  /** `owner/name`, a public repository. */
  repo: string;
  /** The name without the owner. */
  name: string;
  commits: number;
  days: number;
  /** 0..1 of the top repo. */
  ratio: number;
  background: string;
  time: number;
  degree: number;
};

export type EraTile = {
  year: number;
  repo: string;
  name: string;
  /** Only known for repos the user owns; omitted otherwise. */
  language?: string;
  commits: number;
  background: string;
  foreground: string;
  time: number;
  degree: number;
};

/** What the explore readout shows for one bar or tile. */
export type Reading = { title: string; detail: string };

export type MainRepoPlan = {
  repo: MainRepo;
  /** Short name of the main repo. */
  name: string;
  /** 0.35..1: how much the giant name shrinks to fit long names. */
  nameScale: number;
  background: string;
  foreground: string;
  /** "2019 to 2026", or just the year. */
  span: string;
  bars: RepoBar[];
  eras: EraTile[];
  /** Bars first, then eras: the order of `[data-item]` in the view. */
  readings: Reading[];
  slamTime: number;
  duration: number;
};

/** The repository name without the owner. */
export function shortName(repo: string): string {
  return repo.split("/").at(-1) || repo;
}

export function nameScale(name: string): number {
  return Math.max(MIN_NAME_SCALE, Math.min(1, FULL_SIZE_NAME / name.length));
}

function spanOf(repo: MainRepo): string {
  return repo.firstYear === repo.lastYear
    ? String(repo.firstYear)
    : `${repo.firstYear} to ${repo.lastYear}`;
}

function plural(count: number, one: string, many: string): string {
  return `${formatCount(count)} ${count === 1 ? one : many}`;
}

export function barReading(
  bar: Pick<RepoBar, "repo" | "commits" | "days">,
): Reading {
  return {
    title: shortName(bar.repo),
    detail: `${bar.repo} · ${plural(bar.commits, "commit", "commits")} to public repositories · ${plural(bar.days, "day", "days")} with a commit`,
  };
}

export function eraReading(
  era: Pick<EraTile, "year" | "repo" | "commits" | "language">,
): Reading {
  const language = era.language ? ` · ${era.language}` : "";
  return {
    title: String(era.year),
    detail: `${era.repo}${language} · ${plural(era.commits, "commit", "commits")} that year`,
  };
}

/** Everything the scene draws, or null when no public repo has commits. */
export function planMainRepo(
  history: History,
  firstYear: number | null,
): MainRepoPlan | null {
  const years = history.years;
  const main = mainRepo(years);
  if (!main) return null;
  const top = topRepos(years);
  const peak = Math.max(1, ...top.map((repo) => repo.commits));
  const baseYear = firstYear ?? years[0]?.year ?? 0;

  const bars: RepoBar[] = top.map((repo, index) => ({
    repo: repo.repo,
    name: shortName(repo.repo),
    commits: repo.commits,
    days: repo.days,
    ratio: repo.commits / peak,
    background: index === 0 ? BLOCK_COLORS.background : neutrals.ink,
    time: quantizeUp(
      LEAD_SECONDS + SLAM_SECONDS + index * BAR_STEP_SECONDS,
      GRID_SECONDS,
    ),
    degree: Math.min(MAX_DEGREE, index * 2),
  }));

  const barsEnd = bars.at(-1)?.time ?? 0;
  const eraStart = quantizeUp(barsEnd + BAR_SECONDS, GRID_SECONDS);
  // Languages need the owned repos, which the history payload does not carry.
  const recent = eras(years, [], history.user.login).slice(-MAX_ERAS);
  const tiles: EraTile[] = recent.map((era, index) => {
    const colors = blockForYearIndex(era.year - baseYear);
    return {
      year: era.year,
      repo: era.repo,
      name: shortName(era.repo),
      ...(era.language ? { language: era.language } : {}),
      commits: era.commits,
      background: colors.background,
      foreground: colors.foreground,
      time: quantizeUp(eraStart + index * ERA_STEP_SECONDS, GRID_SECONDS),
      degree: Math.min(MAX_DEGREE, 3 + index),
    };
  });

  const name = shortName(main.repo);
  const lastTime = tiles.at(-1)?.time ?? eraStart;
  return {
    repo: main,
    name,
    nameScale: nameScale(name),
    background: BLOCK_COLORS.background,
    foreground: BLOCK_COLORS.foreground,
    span: spanOf(main),
    bars,
    eras: tiles,
    readings: [...bars.map(barReading), ...tiles.map(eraReading)],
    slamTime: quantizeUp(LEAD_SECONDS, GRID_SECONDS),
    duration: Math.max(MIN_SECONDS, lastTime + FLIP_SECONDS + TAIL_SECONDS),
  };
}

/** 0..1 of an ease-out-quart animation that starts at `start`. */
export function progressAt(
  start: number,
  length: number,
  seconds: number,
  reducedMotion: boolean,
): number {
  if (seconds < start) return 0;
  if (reducedMotion) return 1;
  const linear = Math.min(1, (seconds - start) / length);
  return 1 - (1 - linear) ** 4;
}
