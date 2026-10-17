import {
  contributionsLabel,
  FIXED_LINE,
  formatCount,
  privateLine,
} from "@/og/poster";

export { FIXED_LINE };

/** "@login: 1,234 contributions, 2019 to 2024". Calendar totals, never commits. */
export function summaryLine(
  login: string,
  total: number,
  firstYear: number,
  lastYear: number,
): string {
  const span =
    firstYear === lastYear ? `${firstYear}` : `${firstYear} to ${lastYear}`;
  return `@${login}: ${formatCount(total)} ${contributionsLabel(total)}, ${span}`;
}

/** The honest private share, only when there is one. */
export function privateNote(privateContributions: number): string | null {
  return privateLine(privateContributions);
}

/** Per-year bars for the poster; ratio is relative to the tallest year. */
export function yearBars(
  firstYear: number,
  lastYear: number,
  contributionsByYear: ReadonlyMap<number, number>,
): { year: number; contributions: number; ratio: number }[] {
  const years = Array.from(
    { length: lastYear - firstYear + 1 },
    (_, index) => firstYear + index,
  );
  const peak = Math.max(1, ...contributionsByYear.values());
  return years.map((year) => {
    const contributions = contributionsByYear.get(year) ?? 0;
    return { year, contributions, ratio: contributions / peak };
  });
}

/**
 * Where "Challenge someone" goes: the landing with this login as player 1.
 * The landing does not read `vs` yet (follow-up).
 */
export function challengeHref(login: string): string {
  return `/?vs=${encodeURIComponent(login)}`;
}

export type ShareData = { title: string; text: string; url: string };
export type ShareOutcome = "shared" | "copied" | "cancelled" | "failed";

export type ShareTools = {
  share?: (data: ShareData) => Promise<void>;
  writeText?: (text: string) => Promise<void>;
};

/**
 * Web Share when the browser has it; otherwise (or when it fails for a reason
 * other than the user closing the sheet) copy the URL to the clipboard.
 */
export async function shareProfile(
  data: ShareData,
  tools: ShareTools,
): Promise<ShareOutcome> {
  if (tools.share) {
    try {
      await tools.share(data);
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return "cancelled";
      }
    }
  }
  if (!tools.writeText) return "failed";
  try {
    await tools.writeText(data.url);
    return "copied";
  } catch {
    return "failed";
  }
}

/** The live-region message for an outcome; empty when nothing should be said. */
export function shareMessage(outcome: ShareOutcome): string {
  if (outcome === "copied") return "Copied";
  if (outcome === "failed") return "Could not share. Copy the address instead.";
  return "";
}
