import { formatCount } from "@/features/sequencer/model/format";
import { blockForYearIndex } from "@/features/sequencer/model/plan";
import { focusRing } from "@/ui/classes";
import { SceneFrame } from "@/ui/SceneFrame";
import { blocks, neutrals } from "@/ui/tokens";
import type { MonthStrip } from "./months";
import { LEVEL_ALPHA, tint, WEEKS, type YearRow } from "./plan";

/** The empty square of a week without contributions. */
const EMPTY = "#E4E1D8";
const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;
/** Day of the year each month starts on (non-leap): places labels over the weeks. */
const MONTH_STARTS = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

/** A thin ink scrollbar, scoped to the grid: 4px, no track, no arrows. */
const thinScroll =
  "[scrollbar-width:thin] [scrollbar-color:#141414_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-button]:hidden [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-ink";

type HeatmapViewProps = {
  rows: readonly YearRow[];
  strip: MonthStrip | null;
};

/**
 * Scene 2, the markup: every year as a row of 53 week squares tinted in the
 * year's block color with its total. The month strip and its headline sit in
 * the title row on desktop; on a phone they close the grid. Only the grid
 * scrolls. A black tooltip (one element, moved by `explore.ts`) reads the week
 * under the pointer, finger or keyboard. On a phone each row stacks its label
 * and total above full-width squares; from md up they sit in line.
 * The static markup is the finished state; `mount.ts` replays the reveal week
 * by week and `explore.ts` makes each week readable.
 */
export function HeatmapView({ rows, strip }: HeatmapViewProps) {
  const first = rows[0];
  const last = rows.at(-1);
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  const range = first && last ? `${first.year} — ${last.year}` : "";
  const summary = `${range} · ${formatCount(total)} contributions`;

  return (
    <div className="absolute inset-0">
      <SceneFrame
        sceneLabel="Heatmap"
        title={
          <>
            Every year,
            <br />
            week by week.
          </>
        }
        aside={
          <div className="hidden items-end gap-5 md:flex">
            <div className="flex flex-col items-end gap-0.5 text-right">
              {strip && (
                <p className="font-display text-[32px] font-black uppercase leading-[0.95]">
                  {strip.headline}
                </p>
              )}
              <p className="font-mono text-[11px] uppercase tracking-[0.04em] [font-stretch:87.5%]">
                {summary}
              </p>
            </div>
            {strip && <MonthBars strip={strip} className="w-[200px]" small />}
          </div>
        }
      >
        <div
          data-role="tip-host"
          className="absolute inset-0 flex flex-col [--t:64px] [--y:92px]"
        >
          <div
            aria-hidden="true"
            className="grid shrink-0 grid-cols-1 gap-x-3 pr-3 pb-2 font-mono text-[11px] uppercase tracking-[0.06em] [font-stretch:87.5%] md:grid-cols-[var(--y)_minmax(0,1fr)_var(--t)]"
          >
            <span className="hidden md:block" />
            <div className="relative h-4">
              {MONTH_LABELS.map((label, month) => (
                <span
                  key={label}
                  className="absolute top-0"
                  style={{
                    left: `${((MONTH_STARTS[month] ?? 0) / 7 / WEEKS) * 100}%`,
                  }}
                >
                  <span className="md:hidden">{label.slice(0, 1)}</span>
                  <span className="hidden md:inline">{label}</span>
                </span>
              ))}
            </div>
            <span className="hidden md:block" />
          </div>

          <div
            data-role="grid-scroll"
            className={`min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-3 pb-1 ${thinScroll}`}
          >
            <section aria-label="Weeks of each year">
              <div className="relative">
                <div
                  role="img"
                  aria-label={`Contributions per week, one row per year, ${range}. ${formatCount(total)} in total. Each square is one week.`}
                  className="flex flex-col gap-6 md:gap-3.5"
                >
                  {rows.map((row, rowIndex) => {
                    const color = blockForYearIndex(row.colorIndex).background;
                    return (
                      <div
                        key={row.year}
                        data-row={rowIndex}
                        className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 md:grid-cols-[var(--y)_minmax(0,1fr)_var(--t)] md:gap-y-0"
                      >
                        <span
                          data-role="row-label"
                          className="font-mono text-xs uppercase tracking-[0.06em] [font-stretch:87.5%] md:col-start-1 md:row-start-1 md:text-[13px]"
                        >
                          {row.label}
                        </span>
                        <span className="col-start-2 row-start-1 text-right font-display text-[28px] font-extrabold leading-none tabular-nums md:col-start-3 md:text-[26px]">
                          {formatCount(row.total)}
                        </span>
                        <div
                          className="col-span-2 row-start-2 grid h-11 gap-px md:col-span-1 md:col-start-2 md:row-start-1 md:h-[30px] md:gap-[3px]"
                          style={{
                            gridTemplateColumns: `repeat(${WEEKS}, minmax(0, 1fr))`,
                          }}
                        >
                          {row.weeks.map((cell) => (
                            <div
                              key={cell.week}
                              data-cell={rowIndex * WEEKS + cell.week}
                              data-week={cell.week}
                              className={
                                cell.state === "future"
                                  ? "border border-dashed border-ink/25"
                                  : ""
                              }
                              style={{
                                backgroundColor:
                                  cell.state === "absent"
                                    ? undefined
                                    : cell.state === "future"
                                      ? "transparent"
                                      : cell.level === 0
                                        ? EMPTY
                                        : tint(color, LEVEL_ALPHA[cell.level]),
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Explore only: `explore.ts` shows it once the scene has ended. */}
                <div
                  data-role="scrub"
                  hidden
                  role="slider"
                  tabIndex={-1}
                  aria-label="Contributions by week"
                  aria-orientation="horizontal"
                  aria-valuemin={0}
                  aria-valuemax={Math.max(0, rows.length * WEEKS - 1)}
                  aria-valuenow={0}
                  aria-valuetext={summary}
                  className={`absolute inset-y-0 left-0 right-0 touch-pan-y md:left-[calc(var(--y)+0.75rem)] md:right-[calc(var(--t)+0.75rem)] ${focusRing}`}
                />
              </div>
              <div className="mt-10 flex flex-col gap-4 pb-4 md:hidden">
                {strip && (
                  <p className="font-display text-[40px] font-black uppercase leading-[0.9]">
                    {strip.headline}
                  </p>
                )}
                <p className="font-mono text-[11px] uppercase tracking-[0.04em] [font-stretch:87.5%]">
                  {summary}
                </p>
                {strip && <MonthBars strip={strip} className="w-full" />}
              </div>
            </section>
          </div>

          {/* Explore only: moved over the week under the pointer by `explore.ts`. */}
          <div
            data-role="tip"
            hidden
            aria-hidden="true"
            className="pointer-events-none absolute top-0 left-0 z-20 whitespace-nowrap bg-ink px-3.5 py-2.5 text-paper"
          >
            <p
              data-role="tip-title"
              className="font-display text-[26px] font-black leading-none"
            />
            <p
              data-role="tip-detail"
              className="mt-1 font-mono text-[11px] [font-stretch:87.5%]"
            />
            <span
              data-role="tip-arrow"
              className="absolute size-3 rotate-45 bg-ink"
            />
          </div>
        </div>
      </SceneFrame>
    </div>
  );
}

/** Twelve bars of average contributions per calendar month, with their initials. */
function MonthBars({
  strip,
  className = "",
  small = false,
}: {
  strip: MonthStrip;
  className?: string;
  small?: boolean;
}) {
  return (
    <div
      role="img"
      aria-label={`Average contributions per month. ${strip.headline} ${strip.detail}`}
      className={`grid grid-cols-12 gap-[3px] ${className}`}
    >
      {strip.bars.map((bar) => (
        <div key={bar.month} className="flex min-w-0 flex-col gap-1">
          <div className={`flex items-end ${small ? "h-14" : "h-28"}`}>
            <div
              className={`box-border w-full ${bar.isQuiet ? "border-2 border-dashed border-ink" : ""}`}
              style={{
                height: `${Math.max(bar.isQuiet ? 6 : 2, bar.ratio * 100)}%`,
                backgroundColor: bar.isTop
                  ? blocks.safety
                  : bar.isQuiet
                    ? "transparent"
                    : neutrals.ink,
              }}
            />
          </div>
          <span
            aria-hidden="true"
            className={`text-center font-mono [font-stretch:87.5%] ${small ? "text-[9px]" : "text-xs"}`}
          >
            {bar.letter}
          </span>
        </div>
      ))}
    </div>
  );
}
