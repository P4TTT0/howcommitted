import { formatCount } from "@/features/sequencer/model/format";
import { blockForYearIndex } from "@/features/sequencer/model/plan";
import { focusRing } from "@/ui/classes";
import { ReadoutBox, SceneFrame } from "@/ui/SceneFrame";
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

type HeatmapViewProps = {
  rows: readonly YearRow[];
  strip: MonthStrip | null;
};

/**
 * Scene 2, the markup: every year as a row of 53 week squares tinted in the
 * year's block color with its total, then a summary section (range readout,
 * month strip, legend) below the grid. The whole scene scrolls vertically in
 * one container so nothing is squeezed or clipped. On a phone each row stacks
 * its label and total above full-width squares; from md up they sit in line.
 * The static markup is the finished state; `mount.ts` replays the reveal week
 * by week and `explore.ts` makes each week readable.
 */
export function HeatmapView({ rows, strip }: HeatmapViewProps) {
  const first = rows[0];
  const last = rows.at(-1);
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  const range = first && last ? `${first.year} — ${last.year}` : "";

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
      >
        <div className="absolute inset-0 overflow-y-auto overflow-x-hidden [--t:64px] [--y:92px]">
          <section aria-label="Weeks of each year">
            <div
              aria-hidden="true"
              className="sticky top-0 z-10 grid grid-cols-1 gap-x-3 bg-paper pb-2 font-mono text-[11px] uppercase tracking-[0.06em] [font-stretch:87.5%] md:grid-cols-[var(--y)_minmax(0,1fr)_var(--t)]"
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

            <div className="relative">
              <div
                role="img"
                aria-label={`Contributions per week, one row per year, ${range}. ${formatCount(total)} in total. Each square is one week.`}
                className="flex flex-col gap-6 md:gap-4"
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
                      <span className="col-start-2 row-start-1 text-right font-display text-[28px] font-extrabold leading-none tabular-nums md:col-start-3 md:text-[30px]">
                        {formatCount(row.total)}
                      </span>
                      <div
                        className="col-span-2 row-start-2 grid h-11 gap-px md:col-span-1 md:col-start-2 md:row-start-1 md:h-14 md:gap-[3px]"
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
                aria-valuetext={`${range}: ${formatCount(total)} contributions`}
                className={`absolute inset-y-0 left-0 right-0 touch-none md:left-[calc(var(--y)+0.75rem)] md:right-[calc(var(--t)+0.75rem)] ${focusRing}`}
              />
            </div>
          </section>

          <section
            aria-label="Summary"
            className="mt-12 flex flex-col gap-8 pb-6 md:mt-16 md:gap-10"
          >
            <ReadoutBox
              className="flex flex-col justify-center"
              title={
                <span data-role="readout-title" className="block">
                  {range}
                </span>
              }
              detail={
                <span data-role="readout-detail" className="block">
                  {formatCount(total)} contributions
                </span>
              }
            />
            {strip && <MonthStripView strip={strip} />}
            <div
              aria-hidden="true"
              className="flex items-center gap-1.5 font-mono text-[11px] uppercase [font-stretch:87.5%]"
            >
              <span>Less</span>
              <span className="size-4" style={{ backgroundColor: EMPTY }} />
              {LEVEL_ALPHA.slice(1).map((alpha) => (
                <span
                  key={alpha}
                  className="size-4"
                  style={{ backgroundColor: tint(neutrals.ink, alpha) }}
                />
              ))}
              <span>More</span>
            </div>
          </section>
        </div>
      </SceneFrame>
    </div>
  );
}

/** Twelve bars of average contributions per calendar month, and its headline. */
function MonthStripView({ strip }: { strip: MonthStrip }) {
  return (
    <div className="flex flex-col gap-5">
      <p className="font-display text-[40px] font-black uppercase leading-[0.9] md:text-6xl">
        {strip.headline}
      </p>
      <div
        role="img"
        aria-label={`Average contributions per month. ${strip.headline} ${strip.detail}`}
        className="grid w-full grid-cols-12 gap-1.5 md:max-w-[640px] md:gap-2"
      >
        {strip.bars.map((bar) => (
          <div key={bar.month} className="flex min-w-0 flex-col gap-1.5">
            <div className="flex h-28 items-end md:h-36">
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
              className="text-center font-mono text-xs [font-stretch:87.5%]"
            >
              {bar.letter}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
