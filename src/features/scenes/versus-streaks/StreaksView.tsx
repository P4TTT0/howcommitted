import { swatchClass } from "@/features/versus/palette";
import { SceneFrame } from "@/ui/SceneFrame";
import { dayCount, rangeText, type StreakRow, type StreaksPlan } from "./plan";

/** Most year labels the axis of a phone holds. */
const MAX_YEAR_LABELS = 6;

/** A label starting past this percent would run out of the axis. */
const LAST_LABEL_AT = 90;

const SIDE_CLASS = "sm:w-[210px] sm:shrink-0 lg:w-[250px]";

function Legend() {
  return (
    <span className="flex flex-col gap-1.5 [font-stretch:87.5%]">
      <span className="flex items-center gap-2.5">
        <span aria-hidden="true" className="h-3.5 w-7 shrink-0 bg-ink" />
        Longest run of days in a row
      </span>
      <span className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="h-2.5 w-7 shrink-0 border-2 border-dashed border-ink"
        />
        Longest quiet stretch
      </span>
    </span>
  );
}

function trackLabel(row: StreakRow): string {
  const parts = [
    row.streak
      ? `Longest run ${dayCount(row.streak.days)}, ${rangeText(row.streak.start, row.streak.end)}`
      : "No run of days in a row",
  ];
  if (row.quiet) {
    parts.push(
      `longest quiet stretch ${dayCount(row.quiet.days)}, ${rangeText(row.quiet.start, row.quiet.end)}`,
    );
  }
  return `@${row.login}: ${parts.join("; ")}`;
}

function Row({ row }: { row: StreakRow }) {
  return (
    <li
      data-reveal={row.index}
      className="flex flex-col gap-1.5 border-b border-ink py-2 sm:flex-row sm:items-center sm:gap-6 sm:py-2.5"
    >
      <div className={`flex min-w-0 flex-col gap-0.5 ${SIDE_CLASS}`}>
        <div className="flex items-baseline justify-between gap-3 sm:flex-col sm:items-start sm:justify-start sm:gap-0.5">
          <p className="flex min-w-0 items-center gap-2 font-mono text-xs font-bold">
            <span
              aria-hidden="true"
              className={`size-3 shrink-0 rounded-full ${swatchClass(row.index)}`}
            />
            <span className="min-w-0 [overflow-wrap:anywhere]">
              @{row.login}
            </span>
          </p>
          <p className="shrink-0 font-display text-3xl font-black leading-[0.9] sm:text-[clamp(2.5rem,5vw,4rem)]">
            {row.streak ? dayCount(row.streak.days) : "No run"}
          </p>
        </div>
        <p className="font-mono text-[11px] leading-[1.5] [font-stretch:87.5%]">
          {row.streak && rangeText(row.streak.start, row.streak.end)}
          {row.streak && row.quiet && " · "}
          {row.quiet && `${dayCount(row.quiet.days)} quiet`}
        </p>
      </div>
      <div
        role="img"
        aria-label={trackLabel(row)}
        className="relative h-7 min-w-0 flex-1 sm:h-14"
      >
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-ink/20"
        />
        {row.streak && (
          <div
            aria-hidden="true"
            className={`absolute inset-y-[10%] min-w-1.5 ${swatchClass(row.index)}`}
            style={{
              left: `${row.streak.left}%`,
              width: `${row.streak.width}%`,
            }}
          />
        )}
        {row.quiet && (
          <div
            aria-hidden="true"
            className="absolute inset-y-[28%] min-w-1.5 border-2 border-dashed border-ink"
            style={{
              left: `${row.quiet.left}%`,
              width: `${row.quiet.width}%`,
            }}
          />
        )}
      </div>
    </li>
  );
}

/**
 * Versus scene 5, the markup: each developer's longest run of days in a row
 * (solid) and longest quiet stretch (dashed) on one shared timeline, in the
 * order they were added. A phone stacks the numbers over the track; wider
 * screens put them side by side.
 */
export function StreaksView({ plan }: { plan: StreaksPlan }) {
  const labelEvery = Math.ceil(plan.years.length / MAX_YEAR_LABELS);
  return (
    <div className="absolute inset-0">
      <SceneFrame
        sceneLabel="Streaks"
        title="Longest streaks."
        note={<Legend />}
      >
        <section
          aria-label="Longest streaks of each developer"
          className="flex h-full min-h-0 flex-col gap-3"
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <div className="flex gap-6" aria-hidden="true">
              <div className={`hidden ${SIDE_CLASS} sm:block`} />
              <div className="relative h-6 min-w-0 flex-1 border-b-2 border-ink font-mono text-[11px] [font-stretch:87.5%]">
                {plan.years.map((year, index) =>
                  index % labelEvery === 0 && year.left <= LAST_LABEL_AT ? (
                    <span
                      key={year.year}
                      className="absolute top-0"
                      style={{ left: `${year.left}%` }}
                    >
                      {year.year}
                    </span>
                  ) : null,
                )}
              </div>
            </div>
            <ul className="flex flex-1 flex-col justify-evenly">
              {plan.rows.map((row) => (
                <Row key={row.login.toLowerCase()} row={row} />
              ))}
            </ul>
          </div>
          <div
            data-reveal={plan.rows.length}
            className="flex shrink-0 flex-col gap-1 bg-ink px-3.5 py-2.5 text-paper sm:px-[18px] sm:py-3.5"
          >
            {plan.callout && (
              <p className="min-w-0 font-display text-xl font-extrabold uppercase leading-none [overflow-wrap:anywhere] sm:text-3xl">
                {plan.callout}
              </p>
            )}
            <p className="min-w-0 font-mono text-[11px] [font-stretch:87.5%] sm:text-xs">
              A quiet stretch is days without a contribution between two active
              days.
            </p>
            {plan.privateNote && (
              <p className="min-w-0 font-mono text-[11px] [overflow-wrap:anywhere] [font-stretch:87.5%] sm:text-xs">
                {plan.privateNote}
              </p>
            )}
          </div>
        </section>
      </SceneFrame>
    </div>
  );
}
