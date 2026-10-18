import { swatchClass } from "@/features/versus/palette";
import { SceneFrame } from "@/ui/SceneFrame";
import { LONG_DAYS, SHORT_DAYS, type SyncPlan } from "./plan";

/**
 * Versus scene 6, the markup: seven weekdays, one thin bar per developer in
 * each, all on one scale (the share of that developer's own contributions).
 * Below, the pairs whose weeks overlap most and least.
 */
export function RhythmSyncView({ plan }: { plan: SyncPlan }) {
  return (
    <div className="absolute inset-0">
      <SceneFrame
        sceneLabel="Rhythm sync"
        title="Your weeks, side by side."
        note="Each bar is that weekday's share of a developer's contributions."
      >
        <section
          aria-label="Weekday shares of each developer"
          className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto sm:gap-4"
        >
          <ul className="flex shrink-0 flex-wrap gap-2">
            {plan.people.map((person) => (
              <li
                key={person.login.toLowerCase()}
                className="flex min-h-7 max-w-full min-w-0 items-center gap-2 rounded-full border-2 border-ink px-3 font-mono text-xs font-bold [font-stretch:87.5%]"
              >
                <span
                  aria-hidden="true"
                  className={`size-3 shrink-0 rounded-full ${swatchClass(person.index)}`}
                />
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  @{person.login}
                </span>
              </li>
            ))}
          </ul>
          <div className="grid min-h-20 flex-1 grid-cols-7 gap-1.5 sm:gap-6">
            {SHORT_DAYS.map((short, day) => (
              <div
                key={short}
                data-reveal={day}
                role="img"
                aria-label={`${LONG_DAYS[day]}: ${plan.people
                  .map((person) => `@${person.login} ${person.percents[day]}%`)
                  .join(", ")}`}
                className="flex min-w-0 flex-col gap-1.5"
              >
                <div
                  aria-hidden="true"
                  className="flex min-h-0 flex-1 items-end gap-px border-b-2 border-ink sm:gap-1"
                >
                  {plan.people.map((person) => (
                    <div
                      key={person.login.toLowerCase()}
                      className={`min-w-0 flex-1 ${swatchClass(person.index)}`}
                      style={{
                        height: `${((person.shares[day] ?? 0) / plan.scale) * 100}%`,
                      }}
                    />
                  ))}
                </div>
                <p
                  aria-hidden="true"
                  className="text-center font-mono text-[11px] uppercase [font-stretch:87.5%] sm:text-xs"
                >
                  {short}
                </p>
              </div>
            ))}
          </div>
          <ul
            data-reveal={SHORT_DAYS.length}
            className="grid shrink-0 gap-2 sm:grid-cols-2 sm:gap-4"
          >
            {plan.cards.map((card, index) => (
              <li
                key={card.label}
                className={`flex min-w-0 flex-col gap-0.5 px-3 py-2 sm:px-[18px] sm:py-3.5 ${
                  index === 0
                    ? "bg-ink text-paper"
                    : "border-2 border-ink text-ink"
                }`}
              >
                <p className="font-mono text-[11px] uppercase [font-stretch:87.5%]">
                  {card.label}
                </p>
                <p className="font-display text-xl font-black leading-none [overflow-wrap:anywhere] sm:text-4xl">
                  {card.names}
                </p>
                <p className="font-mono text-[11px] leading-[1.5] [overflow-wrap:anywhere] [font-stretch:87.5%] sm:text-xs">
                  {card.detail}
                </p>
              </li>
            ))}
          </ul>
          {plan.privateNote && (
            <p className="shrink-0 font-mono text-[11px] leading-[1.5] [overflow-wrap:anywhere] [font-stretch:87.5%]">
              {plan.privateNote}
            </p>
          )}
        </section>
      </SceneFrame>
    </div>
  );
}
