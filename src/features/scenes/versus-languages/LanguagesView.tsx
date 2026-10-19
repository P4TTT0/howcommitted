import { FitText } from "@/features/scenes/finale/FitText";
import { swatchClass } from "@/features/versus/palette";
import { SceneFrame } from "@/ui/SceneFrame";
import type { LanguagePerson, LanguagesPlan } from "./plan";

/** Meaning of the removed on-screen note, kept for assistive technology. */
const SCOPE =
  "Languages of each developer's own public repositories, by code size.";

/** Cards per row on a tablet: two rows at most for five developers. */
const TABLET_COLUMNS: Record<number, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-2",
  5: "sm:grid-cols-3",
};

/** Wide screens give every developer a column, up to the five a lineup holds. */
const WIDE_COLUMNS: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
};

/** Text on each swatch: ink where white would read too faintly. */
const FOREGROUND = [
  "text-paper",
  "text-paper",
  "text-ink",
  "text-paper",
  "text-ink",
] as const;

/** A phone lists three languages per card, larger screens five. */
const PHONE_ROWS = 3;

/**
 * One developer, same shape for everyone: a block in their color (login, the
 * favorite language, its share) and a thin bar per language below it.
 */
function Card({ person }: { person: LanguagePerson }) {
  const foreground = FOREGROUND[person.index % FOREGROUND.length];
  return (
    <li
      data-reveal={person.index}
      className="flex min-w-0 flex-col border-2 border-ink sm:min-h-0"
    >
      <div
        className={`@container flex flex-1 sm:min-h-0 flex-col gap-1.5 px-4 py-3 sm:py-4 ${swatchClass(person.index)} ${foreground}`}
      >
        <p className="min-w-0 [overflow-wrap:anywhere] font-mono text-xs font-bold">
          @{person.login}
        </p>
        <FitText className="mt-auto font-display text-[length:min(24cqi,12dvh)] font-black uppercase leading-[0.82] max-sm:text-[length:min(20cqi,10dvh)]">
          {person.top ? person.top.name : "—"}
        </FitText>
        <p className="font-mono text-xs [font-stretch:87.5%]">
          {person.top
            ? `${person.top.percent}% of their public code`
            : "No public repositories"}
        </p>
      </div>
      <ul className="flex shrink-0 flex-col gap-2 px-4 py-3 sm:min-h-[8.5rem] lg:py-4">
        {person.rows.map((row, position) => (
          <li
            key={row.name}
            title={`${row.name}: ${row.percent}%`}
            className={`grid grid-cols-[minmax(0,40%)_minmax(0,1fr)_2.5rem] items-center gap-2.5 font-mono text-xs [font-stretch:87.5%] ${
              position >= PHONE_ROWS ? "max-sm:hidden" : ""
            }`}
          >
            <span className={`truncate ${position === 0 ? "font-bold" : ""}`}>
              {row.name}
            </span>
            <span aria-hidden="true" className="h-2.5 bg-ink/15">
              <span
                className={`block h-full ${swatchClass(person.index)}`}
                style={{ width: `${row.percent}%` }}
              />
            </span>
            <span className="text-right tabular-nums">{row.percent}%</span>
          </li>
        ))}
      </ul>
    </li>
  );
}

/**
 * Versus scene 4, the markup: one equal card per developer in the order they
 * were added, with their own languages. No scroll from a tablet up (cards go
 * to up to five columns or two rows); a phone stacks compact cards and may
 * scroll.
 */
export function LanguagesView({ plan }: { plan: LanguagesPlan }) {
  const count = plan.people.length;
  const [lead, ...rest] = plan.facts;
  return (
    <div className="absolute inset-0">
      <SceneFrame
        sceneLabel="Languages"
        title="Languages."
        aside={
          lead ? (
            <p
              data-reveal={count}
              className="min-w-0 max-w-full [overflow-wrap:anywhere] bg-ink px-[18px] py-3 font-display text-[length:clamp(1.25rem,2.3vw,1.875rem)] font-black uppercase leading-none text-paper"
            >
              {lead}
            </p>
          ) : undefined
        }
      >
        <section
          aria-label="Favorite languages of each developer"
          aria-describedby="languages-scope"
          className="flex h-full min-h-0 flex-col"
        >
          <p id="languages-scope" className="sr-only">
            {SCOPE}
          </p>
          {rest.length > 0 && <p className="sr-only">{rest.join(" ")}</p>}
          <ul
            className={`grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto sm:auto-rows-[minmax(0,1fr)] sm:gap-4 sm:overflow-visible ${TABLET_COLUMNS[count] ?? "sm:grid-cols-3"} ${WIDE_COLUMNS[count] ?? "lg:grid-cols-5"}`}
          >
            {plan.people.map((person) => (
              <Card key={person.login.toLowerCase()} person={person} />
            ))}
          </ul>
        </section>
      </SceneFrame>
    </div>
  );
}
