import { focusRing } from "@/ui/classes";
import { ReadoutBox, SceneFrame } from "@/ui/SceneFrame";
import { barReading, compactCount, rhythmLine, type WeekPlan } from "./plan";

type WeekShapeViewProps = { plan: WeekPlan };

/**
 * Scene 4, the markup: seven bars Monday first (weekdays forest, weekend
 * signal) with their values, the archetype headline, and the steady/bursty
 * bar. On a phone the order is bars, archetype, rhythm; on desktop the title
 * and archetype sit on the left and the bars and rhythm on the right. The
 * removed sentences stay as screen reader text. The picked day's readout takes
 * the place of the rhythm strip while exploring. The static markup is the
 * finished state; `mount.ts` grows it and `explore.ts` reads the bars.
 */
export function WeekShapeView({ plan }: WeekShapeViewProps) {
  const place = plan.position * 100;
  return (
    <div className="absolute inset-0">
      <SceneFrame sceneLabel="Week shape">
        <div className="flex h-full min-h-0 flex-col gap-3 lg:flex-row lg:gap-14">
          <div className="order-2 flex shrink-0 flex-col justify-between gap-3 lg:order-1 lg:w-[400px] lg:gap-4">
            <h2 className="font-display text-[clamp(2.5rem,7vw,6rem)] font-black uppercase leading-[0.86] sr-only lg:not-sr-only">
              The shape of your week.
            </h2>
            <div className="bg-block-forest px-4 py-3 text-paper lg:px-7 lg:py-6">
              <p className="font-display text-[clamp(2rem,6vw,4rem)] font-black uppercase leading-[0.9]">
                {plan.archetype}
              </p>
            </div>
            <p className="sr-only">
              Every contribution since {plan.firstYear}, folded onto seven days.{" "}
              {plan.monThuPercent}% land Monday to Thursday. Weekends hold{" "}
              {plan.weekendPercent}%.
            </p>
          </div>
          <div className="order-1 flex min-h-0 min-w-0 flex-1 flex-col gap-3 lg:order-2 lg:gap-4">
            <div
              data-role="bars"
              className={`grid min-h-0 flex-1 grid-cols-7 grid-rows-1 items-end gap-1.5 border-b-2 border-ink lg:gap-3.5 ${focusRing}`}
            >
              {plan.bars.map((bar) => (
                <div
                  key={bar.index}
                  data-bar-slot={bar.index}
                  role="img"
                  aria-label={barReading(bar)}
                  className="flex h-full items-end pt-7 outline-offset-[3px] lg:pt-9"
                >
                  <div
                    data-bar={bar.index}
                    aria-hidden="true"
                    className={`relative w-full ${
                      bar.weekend ? "bg-block-signal" : "bg-block-forest"
                    }`}
                    style={{ height: `${bar.ratio * 100}%` }}
                  >
                    <span className="absolute inset-x-0 bottom-full whitespace-nowrap pb-1 text-center font-display text-[clamp(15px,2.4vw,28px)] font-black tabular-nums leading-none">
                      {compactCount(bar.value)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div
              aria-hidden="true"
              className="grid grid-cols-7 gap-1.5 text-center font-mono text-[13px] uppercase [font-stretch:87.5%] lg:gap-3.5"
            >
              {plan.bars.map((bar) => (
                <span key={bar.index}>
                  <span className="lg:hidden">{bar.name.slice(0, 1)}</span>
                  <span className="hidden lg:inline">{bar.short}</span>
                </span>
              ))}
            </div>
            <div className="relative">
              <div className="flex flex-col gap-1.5 bg-ink px-4 py-2.5 text-paper lg:gap-2 lg:px-6 lg:py-4">
                <p className="font-display text-[22px] font-extrabold uppercase leading-none lg:text-[30px]">
                  {plan.rhythmHeadline}
                </p>
                <div aria-hidden="true" className="relative h-3 bg-[#4A4A4A]">
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
                <p className="sr-only">{rhythmLine(plan)}</p>
              </div>
              <div
                data-role="readout"
                aria-hidden="true"
                className="invisible absolute inset-0"
              >
                <ReadoutBox
                  className="flex h-full flex-col justify-center !py-1.5"
                  title={
                    <span data-role="readout-title" className="block">
                      &nbsp;
                    </span>
                  }
                  detail={
                    <span data-role="readout-detail" className="block">
                      &nbsp;
                    </span>
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </SceneFrame>
    </div>
  );
}
