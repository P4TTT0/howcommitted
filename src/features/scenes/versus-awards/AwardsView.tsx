import { swatchClass } from "@/features/versus/palette";
import { SceneFrame } from "@/ui/SceneFrame";
import type { AwardsPlan } from "./plan";

/**
 * Versus scene 7, the markup: one card per award, grouped by developer in the
 * order they were added. A phone stacks slim rows (title and value on one
 * line, the developer under it); wider screens use cards, two or four across.
 */
export function AwardsView({ plan }: { plan: AwardsPlan }) {
  return (
    <div className="absolute inset-0">
      <SceneFrame
        sceneLabel="Awards"
        title="Awards."
        note={
          <span className="[overflow-wrap:anywhere]">
            {plan.privateNote ? `${plan.note} ${plan.privateNote}` : plan.note}
          </span>
        }
      >
        <section aria-label="Awards" className="h-full min-h-0">
          <ul className="grid h-full min-h-0 auto-rows-[minmax(min-content,1fr)] grid-cols-1 gap-1.5 overflow-y-auto sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            {plan.awards.map((award, position) => {
              const slot = award.person;
              return (
                <li
                  key={`${award.login}-${award.id}`}
                  data-reveal={position}
                  className="flex min-h-0 min-w-0 border-2 border-ink sm:flex-col"
                >
                  <div
                    aria-hidden="true"
                    className={`w-2.5 shrink-0 sm:h-3.5 sm:w-auto ${swatchClass(slot)}`}
                  />
                  <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-2.5 py-1 sm:justify-between sm:gap-3 sm:p-[18px]">
                    <div className="flex items-baseline justify-between gap-3 sm:contents">
                      <p className="min-w-0 font-display text-xl font-black uppercase leading-[0.95] sm:text-[clamp(1.75rem,2.6vw,2.5rem)]">
                        {award.title}
                      </p>
                      <div className="shrink-0 sm:order-last sm:shrink">
                        <p className="font-display text-xl font-black leading-[0.9] sm:text-[clamp(2.25rem,3.4vw,3.25rem)]">
                          {award.value}
                        </p>
                        <p className="font-mono text-[11px] leading-[1.5] [font-stretch:87.5%] max-sm:sr-only sm:mt-1.5">
                          {award.metric}
                        </p>
                      </div>
                    </div>
                    <p className="flex min-w-0 items-center gap-2 font-mono text-xs font-bold [font-stretch:87.5%] sm:border-t sm:border-ink sm:pt-2.5 sm:text-[13px]">
                      <span
                        aria-hidden="true"
                        className={`size-3 shrink-0 rounded-full ${swatchClass(slot)}`}
                      />
                      <span className="min-w-0 [overflow-wrap:anywhere]">
                        @{award.login}
                      </span>
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </SceneFrame>
    </div>
  );
}
