import { formatCount } from "@/features/sequencer/model/format";
import { blockForYearIndex } from "@/features/sequencer/model/plan";
import type { YearBar } from "./bars";

/** At most this many year labels fit on the axis of a phone. */
const MAX_YEAR_LABELS = 8;

type YearBlocksViewProps = { bars: readonly YearBar[] };

/**
 * Scene 1, the markup: a readout block (the year being drawn, in its color)
 * above one block per year. Height is the calendar total, color is the year's
 * identity. The static markup is the finished state; `mount.ts` replays it.
 */
export function YearBlocksView({ bars }: YearBlocksViewProps) {
  const labelEvery = Math.ceil(bars.length / MAX_YEAR_LABELS);
  const last = bars.at(-1);
  const lastColors = blockForYearIndex(last?.colorIndex ?? 0);
  const summary = bars
    .map((bar) => `${bar.year} ${formatCount(bar.contributions)}`)
    .join(", ");

  return (
    <div className="absolute inset-0 flex flex-col">
      <section
        data-role="readout"
        aria-hidden="true"
        className="flex h-[30dvh] shrink-0 flex-col justify-between p-4 landscape:flex-row landscape:items-end"
        style={{
          backgroundColor: lastColors.background,
          color: lastColors.foreground,
        }}
      >
        <p
          data-role="year"
          className="font-display text-[min(26vw,13dvh)] font-black leading-[0.8] landscape:text-[min(15vw,24dvh)]"
        >
          {last?.year}
        </p>
        <div className="landscape:text-right">
          <p
            data-role="value"
            className="font-display text-[min(26vw,13dvh)] font-black leading-[0.8] tabular-nums landscape:text-[min(15vw,24dvh)]"
          >
            {formatCount(last?.contributions ?? 0)}
          </p>
          <p className="mt-4 font-mono text-xs uppercase">Contributions</p>
        </div>
      </section>

      <div className="flex min-h-0 flex-1 flex-col px-4 pb-2 pt-4">
        <p className="font-mono text-xs uppercase">Contributions per year</p>
        <div
          role="img"
          aria-label={`Contributions per year: ${summary}`}
          className="mt-3 flex min-h-0 flex-1 items-end gap-1 border-b-2 border-ink"
        >
          {bars.map((bar, index) => {
            const colors = blockForYearIndex(bar.colorIndex);
            return (
              <div
                key={bar.year}
                data-bar={index}
                className="min-w-px flex-1"
                style={{
                  height: `${bar.ratio * 100}%`,
                  minHeight: bar.contributions > 0 ? "2px" : undefined,
                  backgroundColor: colors.background,
                  transformOrigin: "50% 100%",
                }}
              />
            );
          })}
        </div>
        <div
          aria-hidden="true"
          className="mt-1 flex h-5 gap-1 font-mono text-xs"
        >
          {bars.map((bar, index) => (
            <span key={bar.year} className="min-w-px flex-1 whitespace-nowrap">
              {index % labelEvery === 0 ? bar.year : null}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
