import type { LanguageShare } from "@/domain/languages";
import type { VersusProfile } from "@/features/versus/versusProfiles";

export type LanguageRow = {
  name: string;
  /** Whole percent of that developer's code, 0..100. */
  percent: number;
  isOther: boolean;
};

export type LanguagePerson = {
  login: string;
  index: number;
  /** Largest language, never "Other"; null without public code. */
  top: LanguageRow | null;
  rows: LanguageRow[];
};

export type LanguagesPlan = {
  people: LanguagePerson[];
  /** Plain observations about the overlap, 0 to 2 lines. */
  facts: string[];
};

/**
 * Favorite languages of each developer's own public repositories, by code
 * size, in the order they were added. Nothing is ranked: each card lists one
 * developer's own shares. Null when nobody has any public code.
 */
export function planLanguages(
  profiles: readonly VersusProfile[],
): LanguagesPlan | null {
  const people = profiles.map<LanguagePerson>((profile) => {
    const rows = rowsOf(profile.languages ?? []);
    return {
      login: profile.login,
      index: profile.index,
      top: rows.find((row) => !row.isOther) ?? null,
      rows,
    };
  });
  if (people.every((person) => person.top === null)) return null;
  return { people, facts: factsOf(people) };
}

/** Most rows a card lists, "Other" included. */
export const MAX_ROWS = 5;

/**
 * At most five rows. Languages that round to 0% are skipped and, with the
 * ones that do not fit, folded into "Other" so the shares still add up.
 */
function rowsOf(languages: readonly LanguageShare[]): LanguageRow[] {
  const percentOf = (share: number) => Math.round(share * 100);
  const named = languages.filter(
    (language) => !language.isOther && percentOf(language.share) > 0,
  );
  let otherShare = languages.reduce(
    (sum, language) =>
      language.isOther || percentOf(language.share) === 0
        ? sum + language.share
        : sum,
    0,
  );
  const hasOther = () => percentOf(otherShare) > 0;
  let shown = named;
  if (named.length + (hasOther() ? 1 : 0) > MAX_ROWS) {
    shown = named.slice(0, MAX_ROWS - 1);
    otherShare += named
      .slice(MAX_ROWS - 1)
      .reduce((sum, language) => sum + language.share, 0);
  }
  const rows = shown.map<LanguageRow>((language) => ({
    name: language.name,
    percent: percentOf(language.share),
    isOther: false,
  }));
  if (hasOther()) {
    rows.push({ name: "Other", percent: percentOf(otherShare), isOther: true });
  }
  return rows;
}

function factsOf(people: readonly LanguagePerson[]): string[] {
  const facts: string[] = [];
  const named = people.map((person) =>
    person.rows.filter((row) => !row.isOther),
  );
  const holders = new Map<string, number[]>();
  named.forEach((rows, person) => {
    for (const row of rows) {
      holders.set(row.name, [...(holders.get(row.name) ?? []), person]);
    }
  });

  const everyone = [...holders].find(
    ([, who]) => who.length === people.length && people.length > 1,
  );
  if (everyone) {
    const all = people.length === 2 ? "both" : `all ${people.length}`;
    facts.push(`${everyone[0]} shows up for ${all}.`);
  }

  const lone = [...holders].find(
    ([, who]) => who.length === 1 && people.length > 1,
  );
  if (lone) {
    const owner = people[lone[1][0] ?? 0];
    if (owner)
      facts.push(`Only @${owner.login} has ${lone[0]} in their top languages.`);
  }
  return facts;
}
