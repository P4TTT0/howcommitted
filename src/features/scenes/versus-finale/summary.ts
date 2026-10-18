import { formatCount } from "@/features/sequencer/model/format";
import type { VersusEntry } from "@/features/sequencer/types";
import { contributionsLabel } from "@/og/poster";

export type VersusSummary = {
  login: string;
  total: number;
  /** "2019 to 2024", "2024", or "No contributions" without any year. */
  span: string;
  /** "1,234 contributions", the singular for one. */
  totalText: string;
};

/**
 * One summary per developer, in the order they were added. Calendar totals
 * and years only: no rank, no comparison between developers.
 */
export function summarize(entries: readonly VersusEntry[]): VersusSummary[] {
  return entries.map(({ login, model }) => {
    const { firstYear, lastYear } = model;
    const total = model.plan.total;
    let span = "No contributions";
    if (firstYear !== null && lastYear !== null) {
      span =
        firstYear === lastYear ? `${firstYear}` : `${firstYear} to ${lastYear}`;
    }
    return {
      login,
      total,
      span,
      totalText: `${formatCount(total)} ${contributionsLabel(total)}`,
    };
  });
}
