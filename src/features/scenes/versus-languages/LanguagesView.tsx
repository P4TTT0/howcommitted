import { swatchClass } from "@/features/versus/palette";
import { labelClass } from "@/ui/classes";
import { SceneFrame } from "@/ui/SceneFrame";
import type { LanguagePerson, LanguagesPlan } from "./plan";

/** Wide screens give every developer a column, up to the five a lineup holds. */
const WIDE_COLUMNS: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
};

/** The segments of a phone's bar fade out, so each language reads apart. */
const SEGMENT_OPACITY = [1, 0.7, 0.5, 0.35, 0.22, 0.12] as const;

/** "Python 25% · Rust 15%": the next three languages after the favorite, as one line. */
function othersLine(person: LanguagePerson): string {
  return person.rows
    .filter((row) => !row.isOther)
    .slice(1, 4)
    .map((row) => `${row.name} ${row.percent}%`)
    .join(" · ");
}

/**
 * One developer. A phone gets a slim row (favorite and share on one line, a
 * segmented bar, the rest as text); from the small breakpoint up it is a card
 * with a bar per language.
 */
function Card({ person }: { person: LanguagePerson }) {
  return (
    <li
      data-reveal={person.index}
      className="flex min-w-0 border-2 border-ink sm:flex-col"
    >
      <div
        aria-hidden="true"
        className={`w-2.5 shrink-0 sm:h-3 sm:w-auto ${swatchClass(person.index)}`}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 p-2 sm:gap-1.5 sm:p-4">
        <p className="min-w-0 [overflow-wrap:anywhere] font-mono text-xs font-bold">
          @{person.login}
        </p>
        {person.top ? (
          <>
            <p className={`${labelClass} max-sm:sr-only`}>Favorite language</p>
            <div className="flex items-baseline justify-between gap-3 sm:flex-col sm:items-stretch sm:gap-1.5">
              <p className="min-w-0 font-display text-[1.75rem] font-black uppercase leading-[0.9] [overflow-wrap:anywhere] sm:text-[clamp(1.75rem,3.4vw,3.75rem)]">
                {person.top.name}
              </p>
              <p className="shrink-0 font-display text-lg font-extrabold leading-none sm:text-3xl">
                {person.top.percent}% of their code
              </p>
            </div>
            <div
              aria-hidden="true"
              className="flex h-2 gap-px bg-ink/10 sm:hidden"
            >
              {person.rows.map((row, position) => (
                <div
                  key={row.name}
                  className={`h-full ${swatchClass(person.index)}`}
                  style={{
                    width: `${row.percent}%`,
                    opacity: SEGMENT_OPACITY[position] ?? 0.12,
                  }}
                />
              ))}
            </div>
            {othersLine(person) !== "" && (
              <p className="font-mono text-[11px] leading-[1.5] sm:hidden">
                {othersLine(person)}
              </p>
            )}
            <ul className="mt-auto hidden flex-col gap-2 pt-2 sm:flex">
              {person.rows.map((row, position) => (
                <li key={row.name} className="flex flex-col gap-0.5">
                  <p
                    className={`flex justify-between gap-2 font-mono text-xs ${position === 0 ? "font-bold" : ""}`}
                  >
                    <span className="min-w-0 [overflow-wrap:anywhere]">
                      {row.name}
                    </span>
                    <span className="tabular-nums">{row.percent}%</span>
                  </p>
                  <div aria-hidden="true" className="h-2.5 bg-ink/15">
                    <div
                      className={`h-full ${swatchClass(person.index)}`}
                      style={{ width: `${row.percent}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="font-mono text-xs leading-[1.6]">
            No public code to read languages from.
          </p>
        )}
      </div>
    </li>
  );
}

/**
 * Versus scene 4, the markup: one card per developer in the order they were
 * added, each with their own languages. Slim rows on a phone, two columns on
 * a tablet, one column each on wide screens.
 */
export function LanguagesView({ plan }: { plan: LanguagesPlan }) {
  const count = plan.people.length;
  return (
    <div className="absolute inset-0">
      <SceneFrame
        sceneLabel="Languages"
        title="Languages."
        note="Languages of each developer's own public repositories, by code size."
      >
        <section
          aria-label="Favorite languages of each developer"
          className="flex h-full min-h-0 flex-col gap-2 sm:gap-4"
        >
          <ul
            className={`grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-y-auto sm:auto-rows-fr sm:grid-cols-2 sm:gap-4 ${WIDE_COLUMNS[count] ?? "lg:grid-cols-5"}`}
          >
            {plan.people.map((person) => (
              <Card key={person.login.toLowerCase()} person={person} />
            ))}
          </ul>
          {plan.facts.length > 0 && (
            <div
              data-reveal={count}
              className="grid shrink-0 gap-2 sm:grid-cols-2 sm:gap-4"
            >
              {plan.facts.map((fact, index) => (
                <p
                  key={fact}
                  className={`min-w-0 [overflow-wrap:anywhere] px-3.5 py-2 font-display text-lg font-extrabold uppercase leading-none sm:px-[18px] sm:py-3.5 sm:text-3xl ${
                    index > 0 ? "max-sm:hidden " : ""
                  }${
                    index === 0
                      ? "bg-ink text-paper"
                      : "border-2 border-ink text-ink"
                  }`}
                >
                  {fact}
                </p>
              ))}
            </div>
          )}
        </section>
      </SceneFrame>
    </div>
  );
}
