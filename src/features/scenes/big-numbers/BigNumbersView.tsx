import { formatCount } from "@/features/sequencer/model/format";
import { blockForYearIndex } from "@/features/sequencer/model/plan";
import { focusRing } from "@/ui/classes";
import { type BigNumbersPlan, scopeNote, totalReading } from "./numbers";

type BigNumbersViewProps = { plan: BigNumbersPlan };

/**
 * Scene 5, the markup: four color blocks in a 2x2 grid, one per total, and an
 * honest scope line. The static markup is the finished state; `mount.ts`
 * counts it up and `explore.ts` makes each block readable year by year.
 */
export function BigNumbersView({ plan }: BigNumbersViewProps) {
  return (
    <div className="absolute inset-0 flex flex-col">
      <ul
        aria-label="Totals"
        className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2"
      >
        {plan.numbers.map((number, index) => {
          const colors = blockForYearIndex(number.colorIndex);
          return (
            <li
              key={number.key}
              data-tile={index}
              aria-label={totalReading(number)}
              className={`flex min-w-0 flex-col justify-between p-3 landscape:p-5 ${focusRing}`}
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
      <p className="shrink-0 px-4 py-2 font-mono text-xs">
        {scopeNote(plan.privateContributions)}
      </p>
    </div>
  );
}
