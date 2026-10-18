import { formatCount } from "@/features/sequencer/model/format";
import { focusRing, labelClass } from "@/ui/classes";
import { ReadoutBox, SceneFrame } from "@/ui/SceneFrame";
import { barReading, rhythmLine, type WeekPlan } from "./plan";

type WeekShapeViewProps = { plan: WeekPlan };

/**
 * Scene 4, the markup: seven bars Monday first (weekdays forest, weekend
 * signal), the archetype block with the steady/bursty bar, and a readout for
 * the picked day. The static markup is the finished state; `mount.ts` grows it
 * and `explore.ts` makes the bars readable one by one.
 */
export function WeekShapeView({ plan }: WeekShapeViewProps) {
  const place = plan.position * 100;
  return (
    <div className="absolute inset-0">
      <SceneFrame sceneLabel="Week shape">
        <div className="flex h-full min-h-0 flex-col gap-4 md:flex-row md:gap-14">
          <div className="flex shrink-0 flex-col justify-between gap-4 md:w-[440px]">
            <div className="flex flex-col gap-3 md:gap-4">
              <h2 className="font-display text-[clamp(2.5rem,7vw,6rem)] font-black uppercase leading-[0.86]">
                The shape of your week.
              </h2>
              <p className="font-mono text-[13px] leading-[1.6] [font-stretch:87.5%]">
                Every contribution since {plan.firstYear}, folded onto seven
                days.
              </p>
            </div>
            <div className="flex flex-col gap-2.5 bg-block-forest px-5 py-4 text-paper md:px-7 md:py-6">
              <p className={labelClass}>Your rhythm</p>
              <p className="font-display text-[clamp(2.25rem,6vw,4rem)] font-black uppercase leading-[0.9]">
                {plan.archetype}
              </p>
              <p className="font-mono text-[13px] leading-[1.6] [font-stretch:87.5%]">
                {plan.monThuPercent}% land Monday to Thursday. Weekends hold{" "}
                {plan.weekendPercent}%.
              </p>
              <div className="mt-1 flex flex-col gap-2 border-t border-paper pt-3.5">
                <p className="font-display text-[26px] font-extrabold uppercase leading-none md:text-[30px]">
                  {plan.rhythmHeadline}
                </p>
                <div aria-hidden="true" className="relative h-3 bg-[#2E7D5B]">
                  <div
                    data-role="rhythm-fill"
                    className="absolute inset-y-0 left-0 bg-paper"
                    style={{ width: `${place}%` }}
                  />
                  <div
                    data-role="rhythm-marker"
                    className="absolute -top-1.5 h-6 w-1 bg-block-signal"
                    style={{ left: `calc(${place}% - 2px)` }}
                  />
                </div>
                <div
                  aria-hidden="true"
                  className="flex justify-between font-mono text-[11px] uppercase [font-stretch:87.5%]"
                >
                  <span>Steady</span>
                  <span>Bursty</span>
                </div>
                <p className="font-mono text-[11px] leading-[1.5] [font-stretch:87.5%]">
                  {rhythmLine(plan)}
                </p>
              </div>
            </div>
          </div>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
            <div
              data-role="bars"
              className={`grid min-h-0 flex-1 grid-cols-7 grid-rows-1 items-end gap-2 border-b-2 border-ink md:gap-3.5 ${focusRing}`}
            >
              {plan.bars.map((bar) => (
                <div
                  key={bar.index}
                  data-bar-slot={bar.index}
                  role="img"
                  aria-label={barReading(bar)}
                  className="flex h-full items-end outline-offset-[3px]"
                >
                  <div
                    data-bar={bar.index}
                    aria-hidden="true"
                    className={`flex w-full justify-center overflow-hidden pt-2.5 font-display text-[clamp(18px,2.4vw,28px)] font-black tabular-nums ${
                      bar.weekend
                        ? "bg-block-signal text-ink"
                        : "bg-block-forest text-paper"
                    }`}
                    style={{ height: `${bar.ratio * 100}%` }}
                  >
                    {formatCount(bar.value)}
                  </div>
                </div>
              ))}
            </div>
            <div
              aria-hidden="true"
              className="grid grid-cols-7 gap-2 text-center font-mono text-[13px] uppercase [font-stretch:87.5%] md:gap-3.5"
            >
              {plan.bars.map((bar) => (
                <span key={bar.index}>{bar.short}</span>
              ))}
            </div>
            <div data-role="readout" aria-hidden="true" className="invisible">
              <ReadoutBox
                title={<span data-role="readout-title">&nbsp;</span>}
                detail={<span data-role="readout-detail">&nbsp;</span>}
              />
            </div>
          </div>
        </div>
      </SceneFrame>
    </div>
  );
}
