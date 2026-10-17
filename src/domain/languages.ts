import type { Repo } from "./types";

export type LanguageShare = {
  name: string;
  size: number;
  /** Fraction of total bytes, 0..1. */
  share: number;
  isOther: boolean;
};

const TOP_LANGUAGES = 5;
export const OTHER_LABEL = "Other";

/** Languages of owned repos by bytes: top 5 plus "Other". Not per-commit data. */
export function languageShares(repos: Repo[]): LanguageShare[] {
  const bytes = new Map<string, number>();
  for (const repo of repos) {
    for (const { name, size } of repo.languages) {
      bytes.set(name, (bytes.get(name) ?? 0) + size);
    }
  }
  const sorted = [...bytes]
    .map(([name, size]) => ({ name, size }))
    .sort((a, b) => b.size - a.size || a.name.localeCompare(b.name));
  const total = sorted.reduce((sum, language) => sum + language.size, 0);
  if (total === 0) return [];

  const top = sorted.slice(0, TOP_LANGUAGES);
  const otherSize = sorted
    .slice(TOP_LANGUAGES)
    .reduce((sum, language) => sum + language.size, 0);

  const shares: LanguageShare[] = top.map((language) => ({
    ...language,
    share: language.size / total,
    isOther: false,
  }));
  if (otherSize > 0) {
    shares.push({
      name: OTHER_LABEL,
      size: otherSize,
      share: otherSize / total,
      isOther: true,
    });
  }
  return shares;
}
