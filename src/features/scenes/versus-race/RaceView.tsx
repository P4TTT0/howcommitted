import { formatCount } from "@/features/sequencer/model/format";
import { swatchClass } from "@/features/versus/palette";
import { focusRing } from "@/ui/classes";
import { dayReading, type Race, yearMarks } from "./race";

/** At most this many year labels fit on the axis of a phone. */
const MAX_YEAR_LABELS = 8;

/**
 * The versus race, the markup: one fixed lane per developer in the order they
 * were added, a bar per lane on one shared scale, the running year above and a
 * shared time axis below. Everything that moves is addressed by data
 * attributes from `readout.ts`; the scrub overlay is for `explore.ts`.
 */
export function RaceView({ race }: { race: Race }) {
  const marks = yearMarks(race);
  const labelEvery = Math.ceil(marks.length / MAX_YEAR_LABELS);
  const label = `Cumulative contributions from ${race.firstYear} to ${race.lastYear}: ${race.lanes
    .map((lane) => `@${lane.login} ${formatCount(lane.total)}`)
    .join(", ")}`;

  return (
    <section aria-label={label} className="absolute inset-0 flex flex-col p-4">
      <header className="flex items-end justify-between gap-4">
        <p
          data-role="year"
          className="font-display text-[min(26vw,18dvh)] font-black leading-[0.8] tabular-nums"
        >
          {race.lastYear}
        </p>
        <div className="text-right font-mono text-xs uppercase">
          <p data-role="date" className="tabular-nums">
            {race.firstYear} to {race.lastYear}
          </p>
          <p className="mt-1">Contributions so far</p>
        </div>
      </header>

      <div className="relative mt-4 flex min-h-0 flex-1 flex-col">
        <ul className="flex min-h-0 flex-1 flex-col gap-2">
          {race.lanes.map((lane, index) => (
            <li
              key={lane.login.toLowerCase()}
              className="flex min-h-0 flex-1 flex-col gap-1"
            >
              <div className="flex items-baseline justify-between gap-3 font-mono text-xs">
                <span className="min-w-0 truncate font-bold">
                  @{lane.login}
                </span>
                <span data-lane-value={index} className="tabular-nums">
                  {formatCount(lane.total)}
                </span>
              </div>
              <div className="min-h-3 flex-1 border-2 border-ink">
                <div
                  data-lane-bar={index}
                  className={`h-full ${swatchClass(index)}`}
                  style={{ width: `${(lane.total / race.peak) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
        <div className="relative mt-1 h-6 border-t-2 border-ink font-mono text-xs">
          {marks.map((mark, index) =>
            index % labelEvery === 0 ? (
              <span
                key={mark.year}
                className="absolute top-1"
                style={{ left: `${mark.startProgress * 100}%` }}
              >
                {mark.year}
              </span>
            ) : null,
          )}
          <span
            data-role="playhead"
            aria-hidden="true"
            className="absolute -top-0.5 h-3 w-1 -translate-x-1/2 bg-ink"
            style={{ left: "100%" }}
          />
        </div>
        {/* Explore only: `explore.ts` shows it once the scene has ended. */}
        <div
          data-role="scrub"
          hidden
          role="slider"
          tabIndex={-1}
          aria-label="Contributions by date, every developer"
          aria-orientation="horizontal"
          aria-valuemin={0}
          aria-valuemax={Math.max(0, race.length - 1)}
          aria-valuenow={Math.max(0, race.length - 1)}
          aria-valuetext={dayReading(race, race.length - 1)}
          className={`absolute inset-0 touch-none ${focusRing}`}
        />
      </div>
    </section>
  );
}
