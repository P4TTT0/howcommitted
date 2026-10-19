import type { CSSProperties } from "react";
import { formatCount } from "@/features/sequencer/model/format";
import { focusRing } from "@/ui/classes";
import { ReadoutBox, SceneFrame } from "@/ui/SceneFrame";
import {
  barReading,
  eraReading,
  type MainRepoPlan,
  type Reading,
} from "./plan";

type MainRepoViewProps = { plan: MainRepoPlan };

const MONO = "font-mono [font-stretch:87.5%]";

/** On a phone only the top bars fit; the rest appear from the desktop up. */
const PHONE_BARS = 3;

/**
 * Shortens `text` to `max` characters with an ellipsis, for the hero name,
 * which scales as a whole. Narrow boxes truncate with CSS instead, because a
 * character budget overflows by a pixel when font metrics differ. The full
 * name stays in the aria-labels.
 */
function ellipsize(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

function label({ title, detail }: Reading): string {
  return `${title}: ${detail}`;
}

function Stat({ value, label: text }: { value: string; label: string }) {
  return (
    <div>
      <p className="font-display text-[18px] font-black leading-[1.15] xl:text-4xl">
        {value}
      </p>
      <p className="mt-1">{text}</p>
    </div>
  );
}

/**
 * Scene 3, the markup: the color block of the repo you kept coming back to,
 * the top public repos as bars, and one tile per year for its top repo. The
 * static markup is the finished state; `mount.ts` replays it and `explore.ts`
 * makes every bar and tile readable. Counts are commits to public
 * repositories; private repos are never named.
 *
 * On a phone it is a compact stack that fits without scrolling: the hero
 * (label, name, two stats), the top three bars and the eras as a strip of
 * year tiles. Names are ellipsized there; from the desktop up they scale.
 */
export function MainRepoView({ plan }: MainRepoViewProps) {
  const { repo } = plan;
  return (
    <div className="absolute inset-0">
      <SceneFrame sceneLabel="Main repo + eras">
        <div className="absolute inset-0 flex flex-col gap-3 xl:gap-5">
          <div className="flex min-h-0 flex-1 flex-col gap-3 xl:flex-row xl:gap-12">
            <section
              aria-label={`Most commits to public repositories: ${repo.repo}, ${formatCount(repo.commits)} commits, ${plan.span}`}
              className="relative flex min-h-0 min-w-0 flex-1 flex-col justify-between gap-3 p-4 xl:gap-8 xl:px-9 xl:py-8"
              style={{
                backgroundColor: plan.background,
                color: plan.foreground,
              }}
            >
              <p aria-hidden="true" className={`${MONO} text-xs uppercase`}>
                Most commits · public repositories
              </p>
              <div aria-hidden="true" className="flex min-w-0 flex-col gap-2">
                <p className="hidden font-display font-extrabold uppercase leading-none xl:block xl:text-[44px]">
                  The one you kept coming back to.
                </p>
                <p
                  data-role="name"
                  className="min-w-0 font-display text-[44px] font-black leading-none tracking-[-0.01em] xl:overflow-visible xl:whitespace-normal xl:leading-[0.82] xl:[font-size:calc(clamp(3rem,14vw,9.375rem)*var(--name-scale))] xl:[overflow-wrap:anywhere]"
                  style={
                    {
                      "--name-scale": plan.nameScale,
                      transformOrigin: "0 100%",
                    } as CSSProperties
                  }
                >
                  <span className="block xl:hidden">
                    {ellipsize(plan.name, 14)}
                  </span>
                  <span className="hidden xl:block">
                    {ellipsize(plan.name, 40)}
                  </span>
                </p>
              </div>
              <div
                aria-hidden="true"
                className={`${MONO} flex justify-between gap-x-3 text-[11px] xl:flex-wrap xl:justify-start xl:gap-x-8 xl:gap-y-3 xl:text-[13px]`}
              >
                <Stat value={formatCount(repo.commits)} label="commits" />
                <Stat value={plan.span.replace(" to ", " — ")} label="years" />
              </div>
              <div
                data-role="readout"
                hidden
                aria-hidden="true"
                className="pointer-events-none absolute top-0 right-0 z-10 max-w-full"
              >
                <ReadoutBox
                  title={<span data-role="title" />}
                  detail={<span data-role="detail" />}
                />
              </div>
            </section>

            <section
              aria-label="Where your public commits went"
              className="flex min-w-0 shrink-0 flex-col justify-between gap-4 xl:w-[520px]"
            >
              <p
                aria-hidden="true"
                className={`${MONO} hidden text-xs uppercase tracking-[0.06em] xl:block`}
              >
                Where your public commits went
              </p>
              <ul className="flex flex-col gap-2 xl:gap-3.5">
                {plan.bars.map((bar, index) => (
                  <li
                    key={bar.repo}
                    data-item={index}
                    data-group="bars"
                    role="img"
                    aria-label={label(barReading(bar))}
                    className={`${index < PHONE_BARS ? "flex" : "hidden xl:flex"} min-w-0 flex-col gap-1 ${focusRing}`}
                  >
                    <div
                      aria-hidden="true"
                      className={`${MONO} flex items-baseline justify-between gap-3 text-xs xl:text-[13px]`}
                    >
                      <span className="min-w-0 truncate font-bold">
                        {bar.name}
                      </span>
                      <span className="tabular-nums">
                        {formatCount(bar.commits)}
                      </span>
                    </div>
                    <div
                      aria-hidden="true"
                      className="h-3 bg-ink/[0.08] xl:h-[18px]"
                    >
                      <div
                        data-role="fill"
                        className="h-3 xl:h-[18px]"
                        style={{
                          width: `${Math.round(bar.ratio * 100)}%`,
                          backgroundColor: bar.background,
                          transformOrigin: "0 50%",
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
              <p className="sr-only">
                Public repositories only. Private work counts in your total but
                isn't named here.
              </p>
            </section>
          </div>

          <section
            aria-label="Eras: the repo and language you lived in, year by year"
            className="shrink-0"
          >
            <ul className="grid grid-cols-4 gap-1.5 xl:grid-cols-8 xl:gap-2">
              {plan.eras.map((era, index) => (
                <li
                  key={era.year}
                  data-item={plan.bars.length + index}
                  data-group="eras"
                  role="img"
                  aria-label={label(eraReading(era))}
                  className={`flex h-[60px] min-w-0 flex-col justify-between overflow-hidden px-2 py-1.5 xl:h-[120px] xl:px-3.5 xl:py-3 ${focusRing}`}
                  style={{
                    backgroundColor: era.background,
                    color: era.foreground,
                    transformOrigin: "50% 0",
                  }}
                >
                  <p
                    aria-hidden="true"
                    className="font-display text-2xl font-black leading-none xl:text-[32px]"
                  >
                    {era.year}
                  </p>
                  <div
                    aria-hidden="true"
                    className={`${MONO} min-w-0 text-[10px] leading-tight xl:text-xs xl:leading-normal`}
                  >
                    <p className="truncate font-bold">{era.name}</p>
                    {era.language && (
                      <p className="hidden truncate xl:block">{era.language}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </SceneFrame>
    </div>
  );
}
