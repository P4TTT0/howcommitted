import type { History } from "@/domain/history";
import { type RoleMix, roleMix } from "@/domain/role-mix";
import { blocks } from "@/ui/tokens";

export type MixRole = "commits" | "pullRequests" | "reviews" | "issues";

/** Same colors as the four number blocks above, so the strip reads as their legend. */
const ROLES: readonly { role: MixRole; label: string; color: string }[] = [
  { role: "commits", label: "Commits", color: blocks.ultramarine },
  { role: "pullRequests", label: "Pull requests", color: blocks.safety },
  { role: "reviews", label: "Reviews", color: blocks.forest },
  { role: "issues", label: "Issues", color: blocks.signal },
];

export type MixSegment = {
  role: MixRole;
  label: string;
  color: string;
  /** 0..1 of that year's commits, pull requests, reviews and issues. */
  share: number;
  /** Whole percent, for text. */
  percent: number;
};

export type MixRow = { year: number; segments: MixSegment[] };

export type MixPlan = {
  /** The first year with activity, then the latest one. */
  rows: [MixRow, MixRow];
  /** One honest sentence: shares of each year, no verdict. */
  summary: string;
};

const percent = (share: number) => Math.round(share * 100);

function rowOf(mix: RoleMix): MixRow {
  return {
    year: mix.year,
    segments: ROLES.map(({ role, label, color }) => ({
      role,
      label,
      color,
      share: mix[role],
      percent: percent(mix[role]),
    })),
  };
}

/** "2016: 92% commits, 4% pull requests. 2026: 57% commits, 22% reviews." */
function describe(row: MixRow): string {
  const parts = row.segments
    .filter((segment) => segment.percent > 0)
    .sort((a, b) => b.share - a.share)
    .slice(0, 2)
    .map((segment) => `${segment.percent}% ${segment.label.toLowerCase()}`);
  return `${row.year}: ${parts.join(", ")}.`;
}

/**
 * How the mix of contribution types changed between the first and the latest
 * year with activity. Null when there is only one such year: a comparison needs
 * two. Private contributions are not a role and are left out (see `roleMix`).
 */
export function planMix(history: History): MixPlan | null {
  const active = roleMix(history.years).filter(
    (mix) => mix.commits + mix.pullRequests + mix.reviews + mix.issues > 0,
  );
  const first = active.at(0);
  const last = active.at(-1);
  if (!first || !last || first.year === last.year) return null;

  const rows: [MixRow, MixRow] = [rowOf(first), rowOf(last)];
  return { rows, summary: `${describe(rows[0])} ${describe(rows[1])}` };
}

/** Spoken reading of one row of the strip. */
export function mixReading(row: MixRow): string {
  const parts = row.segments
    .filter((segment) => segment.percent > 0)
    .map((segment) => `${segment.percent}% ${segment.label.toLowerCase()}`);
  return `${row.year}: ${parts.join(", ")}`;
}
