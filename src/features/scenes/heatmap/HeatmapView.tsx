import { formatCount } from "@/features/sequencer/model/format";
import { blockForYearIndex } from "@/features/sequencer/model/plan";
import { focusRing } from "@/ui/classes";
import { ReadoutBox, SceneFrame } from "@/ui/SceneFrame";
import { blocks, neutrals } from "@/ui/tokens";
import type { MonthStrip } from "./months";
import { LEVEL_ALPHA, tint, WEEKS, type YearRow } from "./plan";

/** The empty square of a week without contributions. */
const EMPTY = "#E4E1D8";
/** Height of the tallest month bar. */
const MONTH_BAR_PX = 64;
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
 * year's block color, the year's total on the right, and below it the readout
 * and the month strip. The static markup is the finished state; `mount.ts`
 * replays the reveal week by week and `explore.ts` makes each week readable.
 * The rows scroll vertically when there are more years than the stage fits.
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
        note="Each row is a year. Each square is one week of contributions. Tap a square to read it."
      >
        {/* On a phone the whole scene scrolls vertically; from md up only the rows do. */}
        <div className="absolute inset-0 flex flex-col gap-[18px] overflow-y-auto md:overflow-hidden">
          <div className="shrink-0 [--t:2.75rem] [--y:2.75rem] md:min-h-0 md:flex-1 md:shrink md:overflow-y-auto md:[--t:64px] md:[--y:92px]">
            <div
              aria-hidden="true"
              className="sticky top-0 z-10 grid gap-x-3 bg-paper pb-1.5 font-mono text-[11px] uppercase tracking-[0.06em] [font-stretch:87.5%]"
              style={{ gridTemplateColumns: "var(--y) minmax(0,1fr) var(--t)" }}
            >
              <span />
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
              <span />
            </div>

            <div className="relative flex min-h-full flex-col gap-1.5">
              <div
                role="img"
                aria-label={`Contributions per week, one row per year, ${range}. ${formatCount(total)} in total.`}
                className="flex min-h-full flex-1 flex-col gap-1.5"
              >
                {rows.map((row, rowIndex) => {
                  const color = blockForYearIndex(row.colorIndex).background;
                  return (
                    <div
                      key={row.year}
                      data-row={rowIndex}
                      className="grid min-h-5 flex-1 items-center gap-x-3 md:min-h-4"
                      style={{
                        gridTemplateColumns: "var(--y) minmax(0,1fr) var(--t)",
                      }}
                    >
                      <span
                        data-role="row-label"
                        className="font-mono text-[11px] leading-none [font-stretch:87.5%] md:text-xs"
                      >
                        {row.inProgress ? (
                          <>
                            <span className="md:hidden">{row.year}</span>
                            <span className="hidden md:inline">
                              {row.label}
                            </span>
                          </>
                        ) : (
                          row.label
                        )}
                      </span>
                      <div
                        className="grid h-full gap-px md:gap-[3px]"
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
                      <span className="text-right font-display text-lg font-extrabold leading-none tabular-nums md:text-[22px]">
                        {formatCount(row.total)}
                      </span>
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
                className={`absolute inset-y-0 touch-none ${focusRing}`}
                style={{
                  left: "calc(var(--y) + 0.75rem)",
                  right: "calc(var(--t) + 0.75rem)",
                }}
              />
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-3 md:flex-row md:items-stretch md:gap-8">
            <ReadoutBox
              className="flex flex-col justify-center md:min-w-[300px]"
              title={<span data-role="readout-title">{range}</span>}
              detail={
                <span data-role="readout-detail">
                  {formatCount(total)} contributions
                </span>
              }
            />
            {strip && <MonthStripView strip={strip} />}
            <div
              aria-hidden="true"
              className="flex shrink-0 items-center gap-1.5 font-mono text-[11px] uppercase [font-stretch:87.5%]"
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
          </div>
        </div>
      </SceneFrame>
    </div>
  );
}

/** Twelve bars of average contributions per calendar month, and what they say. */
function MonthStripView({ strip }: { strip: MonthStrip }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3 md:flex-row md:items-center md:gap-5">
      <div
        role="img"
        aria-label={`Average contributions per month. ${strip.headline}`}
        className="flex w-full max-w-[260px] items-end gap-1 md:w-[260px] md:shrink-0"
      >
        {strip.bars.map((bar) => (
          <div
            key={bar.month}
            className="flex flex-1 basis-0 flex-col items-stretch gap-1"
          >
            <div
              className={`box-border ${bar.isQuiet ? "border-2 border-dashed border-ink" : ""}`}
              style={{
                height: Math.max(
                  bar.isQuiet ? 6 : 2,
                  Math.round(bar.ratio * MONTH_BAR_PX),
                ),
                backgroundColor: bar.isTop
                  ? blocks.safety
                  : bar.isQuiet
                    ? "transparent"
                    : neutrals.ink,
              }}
            />
            <span
              aria-hidden="true"
              className="text-center font-mono text-[10px] [font-stretch:87.5%]"
            >
              {bar.letter}
            </span>
          </div>
        ))}
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="font-display text-2xl font-extrabold uppercase leading-none md:text-[30px]">
          {strip.headline}
        </p>
        <p className="font-mono text-xs [font-stretch:87.5%]">{strip.detail}</p>
      </div>
    </div>
  );
}
