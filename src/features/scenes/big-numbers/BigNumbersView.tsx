import { formatCount } from "@/features/sequencer/model/format";
import { blockForYearIndex } from "@/features/sequencer/model/plan";
import { focusRing } from "@/ui/classes";
import { SceneFrame } from "@/ui/SceneFrame";
import { type MixPlan, mixReading } from "./mix";
import { type BigNumbersPlan, scopeNote, totalReading } from "./numbers";

type BigNumbersViewProps = { plan: BigNumbersPlan };

/**
 * Scene 8, the markup: four color blocks in a 2x2 grid, one per total, the mix
 * of contribution types in the first year against the latest, and an honest
 * scope line. The static markup is the finished state; `mount.ts` counts it up
 * and `explore.ts` makes each block readable year by year.
 */
export function BigNumbersView({ plan }: BigNumbersViewProps) {
  return (
    <div className="absolute inset-0">
      <SceneFrame
        sceneLabel="Big numbers"
        title="Big numbers."
        note={scopeNote(plan.privateContributions)}
      >
        <div className="flex h-full min-h-0 flex-col gap-3 md:gap-4">
          <ul
            aria-label="Totals"
            className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-3 md:gap-4"
          >
            {plan.numbers.map((number, index) => {
              const colors = blockForYearIndex(number.colorIndex);
              return (
                <li
                  key={number.key}
                  data-tile={index}
                  aria-label={totalReading(number)}
                  className={`flex min-h-0 min-w-0 flex-col justify-between overflow-hidden p-3 landscape:p-5 ${focusRing}`}
                  style={{
                    backgroundColor: colors.background,
                    color: colors.foreground,
                  }}
                >
                  <p aria-hidden="true" className="font-mono text-xs uppercase">
                    {number.label}
                  </p>
                  <div aria-hidden="true">
                    <p
                      data-role="count"
                      className="font-display text-[min(10vw,9dvh)] font-black leading-[0.85] tabular-nums landscape:text-[min(8vw,16dvh)]"
                    >
                      {formatCount(number.total)}
                    </p>
                    <p
                      data-role="detail"
                      className="mt-2 min-h-4 font-mono text-xs"
                    />
                  </div>
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
 * swatches double as the legend; the sentence carries the same numbers in text.
 */
function MixStrip({ mix }: { mix: MixPlan }) {
  const legend = mix.rows[0].segments;
  return (
    <section
      aria-label="How the mix changed"
      className="flex shrink-0 flex-col gap-2 border-t-2 border-ink pt-3 md:flex-row md:items-center md:gap-6"
    >
      <h3 className="font-display text-2xl font-extrabold uppercase leading-none md:text-[30px]">
        How the mix changed
      </h3>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
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
              {row.segments
                .filter((segment) => segment.share > 0)
                .map((segment) => (
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
      </div>
      <p className="font-mono text-xs leading-[1.6] [font-stretch:87.5%] md:w-[320px] md:shrink-0">
        {mix.summary}
      </p>
    </section>
  );
}
