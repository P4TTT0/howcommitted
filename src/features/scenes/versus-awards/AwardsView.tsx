import { swatchClass } from "@/features/versus/palette";
import { SceneFrame } from "@/ui/SceneFrame";
import { FitText } from "../finale/FitText";
import { Avatar } from "./Avatar";
import type { AwardCard, AwardsPlan } from "./plan";

/** Palette slots whose color is light enough to need dark text. */
const INK_ON = new Set([2, 4]);

const mono = "font-mono [font-stretch:87.5%]";

/**
 * Versus scene 7, the markup: one column per developer, all the same size. A
 * colored header, then that developer's awards as cards of identical size; a
 * developer with fewer awards ends in dashed empty cards. On a phone the
 * columns become stacked sections with the cards two across.
 */
export function AwardsView({ plan }: { plan: AwardsPlan }) {
  const style = {
    "--cols": plan.columns.length,
    "--slots": plan.slots,
  } as React.CSSProperties;
  return (
    <div className="absolute inset-0">
      <SceneFrame
        sceneLabel="Awards"
        title="Awards."
        note={
          <span className="uppercase tracking-[0.06em]">
            Habits, not scores
          </span>
        }
      >
        <section
          aria-label="Awards"
          style={style}
          className="h-full min-h-0 gap-x-4 gap-y-3 max-md:flex max-md:flex-col max-md:gap-5 max-md:overflow-y-auto md:grid md:grid-cols-[repeat(var(--cols),minmax(0,1fr))] md:grid-rows-[auto_repeat(var(--slots),minmax(0,1fr))]"
        >
          {plan.privateNote && <p className="sr-only">{plan.privateNote}</p>}
          {plan.columns.map((column) => (
            <div
              key={column.login}
              data-reveal={column.slot}
              className="min-w-0 max-md:flex max-md:flex-col max-md:gap-2 md:row-span-full md:grid md:grid-rows-subgrid"
            >
              <div
                className={`flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3 lg:px-4 ${swatchClass(column.slot)} ${INK_ON.has(column.slot) ? "text-ink" : "text-paper"}`}
              >
                <Avatar login={column.login} />
                <span
                  className={`min-w-0 max-w-full flex-1 break-all text-xs font-bold lg:text-[15px] ${mono}`}
                >
                  @{column.login}
                </span>
              </div>
              <ul className="grid grid-cols-2 gap-2 md:contents">
                {Array.from({ length: plan.slots }, (_, index) => {
                  const award = column.awards[index];
                  return award ? (
                    <Card key={award.id} award={award} />
                  ) : (
                    <li
                      // biome-ignore lint/suspicious/noArrayIndexKey: fixed empty slots
                      key={`empty-${index}`}
                      aria-hidden="true"
                      data-award-card
                      className="min-h-0 border-2 border-dashed border-ink/40 max-md:hidden"
                    />
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      </SceneFrame>
    </div>
  );
}

function Card({ award }: { award: AwardCard }) {
  return (
    <li
      data-award-card
      className="flex h-32 min-h-0 min-w-0 flex-col justify-between border-2 border-ink p-2 [container-type:size] lg:p-3 md:h-auto lg:px-5 lg:py-4"
    >
      <p className="line-clamp-2 font-display text-[min(34px,10cqw,15cqh)] font-black uppercase leading-[1.2]">
        {award.title}
      </p>
      <div className="min-w-0">
        <FitText className="font-display text-[min(72px,34cqh)] font-black leading-none">
          {award.big}
          {award.unit && <span className="text-[0.39em]">{award.unit}</span>}
        </FitText>
        <p
          className={`mt-1.5 text-[11px] leading-[1.25] [overflow-wrap:anywhere] ${mono}`}
        >
          {award.metric}
        </p>
      </div>
    </li>
  );
}
