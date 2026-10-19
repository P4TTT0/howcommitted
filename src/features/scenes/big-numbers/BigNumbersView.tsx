import type { CSSProperties } from "react";
import { formatCount } from "@/features/sequencer/model/format";
import { blockForYearIndex } from "@/features/sequencer/model/plan";
import { focusRing, labelClass } from "@/ui/classes";
import { SceneFrame } from "@/ui/SceneFrame";
import { type MixPlan, mixReading, visibleSegments } from "./mix";
import {
  type BigNumbersPlan,
  BY_YEAR,
  scopeNote,
  totalReading,
  yearReading,
} from "./numbers";

/** Width of one character of a big number, in em (digits and commas, rounded up). */
const CHARACTER_EM = 0.5;

/** The `--chars` count a tile's font size divides its width by. */
function charsFor(text: string): CSSProperties {
  return { "--chars": text.length } as CSSProperties;
}

type BigNumbersViewProps = { plan: BigNumbersPlan };

/**
 * Scene 8, the markup: four color blocks in a 2x2 grid, one per total, and the
 * mix of contribution types in the first year against the latest. The scope
 * and the mix sentences are spoken, not shown. The static markup is the
 * finished state; `mount.ts` counts it up and `explore.ts` highlights a year's
 * column on hover, focus or tap.
 */
export function BigNumbersView({ plan }: BigNumbersViewProps) {
  return (
    <div className="absolute inset-0">
      <SceneFrame
        sceneLabel="Big numbers"
        title="Big numbers."
        note={
          <>
            <span aria-hidden="true" className={labelClass}>
              Public only
            </span>
            <span className="sr-only">
              {scopeNote(plan.privateContributions)}
            </span>
          </>
        }
      >
        {/* Never scrolls: the tiles share the height the mix strip leaves, and
            each number is sized from its own tile so it stays inside it. */}
        <div className="absolute inset-0 flex flex-col gap-3 md:gap-4">
          <ul
            aria-label="Totals"
            className="grid min-h-0 flex-1 grid-cols-2 [grid-template-rows:repeat(2,minmax(0,1fr))] gap-3 md:gap-4"
          >
            {plan.numbers.map((number, index) => {
              const colors = blockForYearIndex(number.colorIndex);
              const total = formatCount(number.total);
              const peak = Math.max(1, ...number.perYear.map((y) => y.value));
              const widest = Math.max(
                4,
                ...number.perYear.map((y) => formatCount(y.value).length),
              );
              const years = number.perYear.length;
              // One font size for the values and years so the widest still fits its column.
              const columnFont = `min(12px, calc((100cqw / ${Math.max(years, 1)} - 6px) / ${widest * 0.62}))`;
              return (
                <li
                  key={number.key}
                  data-tile={index}
                  aria-label={totalReading(number)}
                  className="flex min-h-0 min-w-0 flex-col gap-2 overflow-hidden p-3 [container-type:size] md:grid md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-6 md:p-4"
                  style={
                    {
                      backgroundColor: colors.background,
                      color: colors.foreground,
                      ...charsFor(total),
                      "--fs-stack": `min(calc((100cqw - 1.5rem) / (var(--chars) * ${CHARACTER_EM})), 22cqh)`,
                      "--fs-split": `min(calc((45cqw - 1.5rem) / (var(--chars) * ${CHARACTER_EM})), 34cqh)`,
                    } as CSSProperties
                  }
                >
                  <div
                    aria-hidden="true"
                    className="flex min-w-0 flex-col gap-1 md:justify-between"
                  >
                    <p className="font-mono text-xs uppercase">
                      {number.label}
                    </p>
                    <p
                      data-role="count"
                      className="font-display text-[length:var(--fs-stack)] font-black leading-[0.85] tabular-nums md:text-[length:var(--fs-split)]"
                    >
                      {total}
                    </p>
                  </div>
                  {years > 0 && (
                    <div
                      data-role="years"
                      className="flex min-h-[4.5rem] min-w-0 flex-1 flex-col gap-1 [container-type:inline-size]"
                    >
                      <p
                        aria-hidden="true"
                        data-role="readout"
                        className="min-h-4 shrink-0 text-right font-mono text-[11px] uppercase [font-stretch:87.5%]"
                      >
                        {BY_YEAR}
                      </p>
                      <div
                        className="flex min-h-0 flex-1 items-end gap-0.5 border-b-2 border-current md:gap-1.5"
                        style={{ fontSize: columnFont }}
                      >
                        {number.perYear.map((entry, yearIndex) => (
                          <button
                            key={entry.year}
                            type="button"
                            data-year-col={yearIndex}
                            aria-label={yearReading(number, entry)}
                            className={`flex h-full min-w-11 flex-1 basis-0 cursor-pointer flex-col items-stretch justify-end p-0 ${focusRing}`}
                          >
                            <span
                              aria-hidden="true"
                              className="mb-1 block text-center font-mono font-bold leading-none"
                            >
                              {formatCount(entry.value)}
                            </span>
                            <span
                              aria-hidden="true"
                              data-role="bar"
                              className="block min-h-0.5 bg-current"
                              style={{
                                height: `max(2px, calc((100% - 1rem) * ${entry.value / peak}))`,
                              }}
                            />
                          </button>
                        ))}
                      </div>
                      <div
                        aria-hidden="true"
                        className="flex shrink-0 gap-0.5 font-mono [font-stretch:87.5%] md:gap-1.5"
                        style={{ fontSize: columnFont }}
                      >
                        {number.perYear.map((entry) => (
                          <span
                            key={entry.year}
                            className="min-w-11 flex-1 basis-0 text-center"
                          >
                            {entry.year}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {plan.mix && <MixStrip mix={plan.mix} />}
        </div>
      </SceneFrame>
    </div>
  );
}

/**
 * The first year against the latest, as two bars split by contribution type.
 * Shares of that year's own mix, never a comparison with other people. The
 * swatches double as the legend; the heading and the sentence are for screen
 * readers.
 */
function MixStrip({ mix }: { mix: MixPlan }) {
  const legend = mix.rows[0].segments;
  return (
    <section
      aria-label="How the mix changed"
      className="flex shrink-0 flex-col gap-1.5 border-t-2 border-ink pt-3"
    >
      <h3 className="sr-only">How the mix changed</h3>
      {mix.rows.map((row) => (
        <div key={row.year} className="flex items-center gap-3">
          <span className="w-11 shrink-0 font-mono text-xs [font-stretch:87.5%]">
            {row.year}
          </span>
          <div
            role="img"
            aria-label={mixReading(row)}
            data-mix-row={row.year}
            className="flex h-5 min-w-0 flex-1 gap-0.5 md:h-[22px]"
          >
            {visibleSegments(row).map((segment) => (
              <span
                key={segment.role}
                className="min-w-0.5"
                style={{
                  flex: `${segment.share} 1 0`,
                  backgroundColor: segment.color,
                }}
              />
            ))}
          </div>
        </div>
      ))}
      <ul
        aria-hidden="true"
        className="flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[11px] uppercase [font-stretch:87.5%]"
      >
        {legend.map((segment) => (
          <li key={segment.role} className="flex items-center gap-1.5">
            <span
              className="size-2.5"
              style={{ backgroundColor: segment.color }}
            />
            {segment.label}
          </li>
        ))}
      </ul>
      <p className="sr-only">{mix.summary}</p>
    </section>
  );
}
