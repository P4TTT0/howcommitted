import { formatCount } from "@/features/sequencer/model/format";
import { swatchClass } from "@/features/versus/palette";
import { focusRing, labelClass, pressable } from "@/ui/classes";
import { SceneFrame } from "@/ui/SceneFrame";
import {
  everyoneLabel,
  MONTH_BLOCK,
  MONTH_NAMES,
  type SharedDaysModel,
  WEEK_COLUMNS,
  type YearData,
} from "./plan";

const MONO = "font-mono [font-stretch:87.5%]";
const WEEKDAY_ROWS = [
  { id: "mon", name: "Mon" },
  { id: "tue", name: "" },
  { id: "wed", name: "Wed" },
  { id: "thu", name: "" },
  { id: "fri", name: "Fri" },
  { id: "sat", name: "" },
  { id: "sun", name: "Sun" },
] as const;

/** One day: a square split between the developers who contributed. */
function Slot({
  slot,
  day,
  year,
  logins,
}: {
  slot: number;
  day: number | null;
  year: YearData;
  logins: readonly string[];
}) {
  // Every slot has the same structure so a year change only repaints it.
  const active = day === null ? [] : (year.days[day]?.people ?? []);
  return (
    <span
      data-slot={slot}
      className={`relative flex aspect-square overflow-hidden bg-[#E4E1D8] data-[selected=true]:z-10 data-[selected=true]:outline-[3px] data-[selected=true]:outline-offset-1 data-[selected=true]:outline-ink ${day === null ? "invisible" : ""}`}
    >
      {logins.map((login, person) => (
        <span
          key={login.toLowerCase()}
          hidden={!active.includes(person)}
          className={`flex-1 ${swatchClass(person)}`}
        />
      ))}
    </span>
  );
}

function stepClass(): string {
  return `inline-flex min-h-11 min-w-11 items-center justify-center border-2 border-ink px-3 text-xs font-bold ${MONO} disabled:cursor-default data-[selected=true]:bg-ink data-[selected=true]:text-paper ${pressable} ${focusRing}`;
}

type SharedDaysViewProps = { model: SharedDaysModel };

/**
 * Versus scene 3, the markup: one calendar year of days, each square split
 * into the colors of the developers who contributed that day, with who and
 * how many underneath. Wide screens show a strip of weeks; phones show one
 * small calendar per month so the splits stay readable. The static markup is
 * the finished state of the latest shared year; `mount.ts` reveals it and
 * `explore.ts` lets the viewer pick a year and a day. Calendar contributions
 * of every type, never commits.
 */
export function SharedDaysView({ model }: SharedDaysViewProps) {
  const year = model.yearData(model.defaultYear);
  const people = model.logins.length;
  const label = `Days with a contribution in ${year.year}, split by developer: ${model.logins
    .map(
      (login, person) =>
        `@${login} ${formatCount(year.stats.perPerson[person] ?? 0)}`,
    )
    .join(
      ", ",
    )}. ${formatCount(year.stats.everyone)} days all of them contributed.`;

  return (
    <div className="absolute inset-0">
      <SceneFrame
        sceneLabel="Shared days"
        title="Who showed up, when."
        note="Each square is a day. It splits into the color of every developer who contributed that day."
      >
        <section
          aria-label={`Shared days, ${model.years[0]} to ${model.years.at(-1)}`}
          className="absolute inset-0 flex flex-col gap-3 overflow-x-hidden overflow-y-auto md:gap-4"
        >
          <ul className="flex flex-wrap gap-2">
            {model.logins.map((login, person) => (
              <li
                key={login.toLowerCase()}
                className={`flex min-h-9 max-w-full items-center gap-2 rounded-full border-2 border-ink px-3 text-xs ${MONO}`}
              >
                <span
                  aria-hidden="true"
                  className={`size-3 shrink-0 rounded-full ${swatchClass(person)}`}
                />
                <span className="min-w-0 truncate font-bold">@{login}</span>
                <span className="shrink-0 tabular-nums">
                  <span data-role="legend-days" data-person={person}>
                    {formatCount(year.stats.perPerson[person] ?? 0)}
                  </span>{" "}
                  days
                </span>
              </li>
            ))}
          </ul>

          {/* The year: chips from md up, a stepper on a phone. */}
          <div
            role="toolbar"
            aria-label="Choose the year"
            data-role="years"
            className="hidden flex-wrap gap-1.5 md:flex"
          >
            {model.years.map((value) => (
              <button
                key={value}
                type="button"
                disabled
                data-year={value}
                data-selected={value === year.year}
                aria-pressed={value === year.year}
                className={stepClass()}
              >
                {value}
              </button>
            ))}
          </div>
          <div
            role="toolbar"
            aria-label="Choose the year"
            data-role="year-step"
            className="flex items-center justify-between gap-2 md:hidden"
          >
            <button
              type="button"
              disabled
              data-step="-1"
              aria-label="Earlier year"
              className={stepClass()}
            >
              ←
            </button>
            <p
              data-role="year-current"
              className="font-display text-4xl font-black leading-none tabular-nums"
            >
              {year.year}
            </p>
            <button
              type="button"
              disabled
              data-step="1"
              aria-label="Later year"
              className={stepClass()}
            >
              →
            </button>
          </div>

          <div className="shrink-0">
            {/* Wide: the year as a strip of weeks, Monday on top. */}
            <div className="hidden md:block">
              <div
                aria-hidden="true"
                className={`relative mb-1 ml-10 h-4 text-[11px] uppercase ${MONO}`}
              >
                {MONTH_NAMES.map((name, month) => (
                  <span
                    key={name}
                    data-month-label={month}
                    className="absolute top-0"
                    style={{
                      left: `${((year.monthColumns[month] ?? 0) / WEEK_COLUMNS) * 100}%`,
                    }}
                  >
                    {name}
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <div
                  aria-hidden="true"
                  className={`grid w-8 shrink-0 grid-rows-7 gap-[2px] text-[11px] uppercase ${MONO}`}
                >
                  {WEEKDAY_ROWS.map(({ id, name }) => (
                    <span key={id} className="flex items-center">
                      {name}
                    </span>
                  ))}
                </div>
                <div
                  data-role="grid-weeks"
                  role="img"
                  aria-label={label}
                  className="grid min-w-0 flex-1 touch-pan-y auto-cols-fr grid-flow-col grid-rows-7 gap-[2px]"
                >
                  {year.weekSlots.map((day, slot) => (
                    <Slot
                      // biome-ignore lint/suspicious/noArrayIndexKey: slots are positions in a fixed grid
                      key={slot}
                      slot={slot}
                      day={day}
                      year={year}
                      logins={model.logins}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Phone: one small calendar per month, four across. */}
            <div
              data-role="grid-months"
              role="img"
              aria-label={label}
              className="grid touch-pan-y grid-cols-4 gap-x-3 gap-y-2 md:hidden"
            >
              {MONTH_NAMES.map((name, month) => (
                <div key={name} className="min-w-0">
                  <p className={`mb-0.5 text-[11px] uppercase ${MONO}`}>
                    {name}
                  </p>
                  <div className="grid grid-cols-7 gap-px">
                    {year.monthSlots
                      .slice(month * MONTH_BLOCK, (month + 1) * MONTH_BLOCK)
                      .map((day, offset) => (
                        <Slot
                          // biome-ignore lint/suspicious/noArrayIndexKey: slots are positions in a fixed grid
                          key={offset}
                          slot={month * MONTH_BLOCK + offset}
                          day={day}
                          year={year}
                          logins={model.logins}
                        />
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-4">
            <div
              aria-live="polite"
              className="bg-ink px-[18px] py-3.5 text-paper lg:min-w-[300px] lg:flex-none"
            >
              <p
                data-role="readout-title"
                className="font-display text-[30px] font-black uppercase leading-none"
              >
                {year.year}
              </p>
              <p
                data-role="readout-detail"
                className={`mt-1 text-xs [overflow-wrap:anywhere] ${MONO}`}
              >
                Select a day to see who showed up.
              </p>
            </div>
            <dl
              data-role="stats"
              className="grid grid-cols-3 gap-2 md:gap-4 lg:flex-1"
            >
              <Stat
                name="everyone"
                label={everyoneLabel(people)}
                value={year.stats.everyone}
              />
              <Stat
                name="anyone"
                label={people === 2 ? "At least one of you" : "At least one"}
                value={year.stats.anyone}
              />
              <Stat
                name="run"
                label="Longest run together"
                value={year.stats.longestRun}
              />
            </dl>
          </div>
        </section>
      </SceneFrame>
    </div>
  );
}

function Stat({
  name,
  label,
  value,
}: {
  name: string;
  label: string;
  value: number;
}) {
  return (
    <div className="min-w-0 border-2 border-ink px-2.5 py-2 md:px-4 md:py-3">
      <dt
        data-stat-label={name}
        className={`${labelClass} text-[11px] leading-tight`}
      >
        {label}
      </dt>
      <dd className="font-display text-[28px] font-black leading-none tabular-nums md:text-5xl">
        <span data-stat={name}>{formatCount(value)}</span>
        <span
          className={`ml-1 text-[11px] font-normal uppercase ${MONO} md:text-xs`}
        >
          days
        </span>
      </dd>
    </div>
  );
}
