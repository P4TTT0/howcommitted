import type { HeatmapCell } from "@/domain/heatmap";
import { formatCount } from "@/features/sequencer/model/format";
import { focusRing } from "@/ui/classes";
import { cellReading } from "./plan";

/** Opacity of the scene color by intensity level (a stepped scale, not a fade). */
const LEVEL_OPACITY = [0, 0.3, 0.55, 0.78, 1] as const;

type HeatmapViewProps = {
  year: number;
  weeks: number;
  cells: readonly HeatmapCell[];
};

/**
 * Scene 3, the markup: one year of calendar days, weekday by week. Intensity is
 * relative to the busiest day of the year. The static markup is the finished
 * state; `mount.ts` replays the reveal, `explore.ts` makes it readable.
 */
export function HeatmapView({ year, weeks, cells }: HeatmapViewProps) {
  const total = cells.reduce((sum, cell) => sum + cell.contributions, 0);
  const summary = `${formatCount(total)} contributions in ${year}`;
  const lastCell = cells.at(-1);

  return (
    <div className="absolute inset-0 flex flex-col gap-3 p-4">
      <div className="shrink-0">
        <p className="font-display text-[min(22vw,12dvh)] font-black leading-[0.85]">
          {year}
        </p>
        <p className="mt-2 font-mono text-xs uppercase">
          Contributions per day, {year}
        </p>
        <p
          data-role="reading"
          aria-hidden="true"
          className="mt-1 min-h-4 font-mono text-xs tabular-nums"
        >
          {summary}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 items-center">
        <div
          className="relative w-full"
          style={{ aspectRatio: `${weeks} / 7`, maxHeight: "100%" }}
        >
          <div
            role="img"
            aria-label={`Contributions per day, ${year}. ${summary}.`}
            className="grid h-full w-full gap-px"
            style={{
              gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))`,
              gridTemplateRows: "repeat(7, minmax(0, 1fr))",
            }}
          >
            {cells.map((cell, index) => (
              <div
                key={cell.date}
                data-cell={index}
                data-week={cell.week}
                className={cell.level === 0 ? "border border-ink/20" : ""}
                style={{
                  gridColumn: cell.week + 1,
                  gridRow: cell.weekday + 1,
                  backgroundColor:
                    cell.level === 0
                      ? undefined
                      : `rgb(31 59 255 / ${LEVEL_OPACITY[cell.level]})`,
                }}
              />
            ))}
          </div>
          {/* Explore only: `explore.ts` shows it once the scene has ended. */}
          <div
            data-role="scrub"
            hidden
            role="slider"
            tabIndex={-1}
            aria-label="Contributions by day"
            aria-orientation="horizontal"
            aria-valuemin={0}
            aria-valuemax={Math.max(0, cells.length - 1)}
            aria-valuenow={Math.max(0, cells.length - 1)}
            aria-valuetext={lastCell ? cellReading(lastCell) : ""}
            className={`absolute inset-0 touch-none ${focusRing}`}
          />
        </div>
      </div>
    </div>
  );
}
