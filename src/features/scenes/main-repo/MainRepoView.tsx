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

function label({ title, detail }: Reading): string {
  return `${title}: ${detail}`;
}

function Stat({ value, label: text }: { value: string; label: string }) {
  return (
    <div>
      <p className="font-display text-[28px] font-black leading-none md:text-4xl">
        {value}
      </p>
      <p>{text}</p>
    </div>
  );
}

/**
 * Scene 3, the markup: the color block of the repo you kept coming back to,
 * the top public repos as bars, and one tile per year for its top repo. The
 * static markup is the finished state; `mount.ts` replays it and `explore.ts`
 * makes every bar and tile readable. Counts are commits to public
 * repositories; private repos are never named.
 */
export function MainRepoView({ plan }: MainRepoViewProps) {
  const { repo } = plan;
  return (
    <div className="absolute inset-0">
      <SceneFrame sceneLabel="Main repo + eras">
        <div className="absolute inset-0 flex flex-col gap-5 overflow-x-hidden overflow-y-auto md:overflow-visible">
          <div className="flex flex-col gap-6 md:min-h-0 md:flex-1 md:flex-row md:gap-12">
            <section
              aria-label={`Most commits to public repositories: ${repo.repo}, ${formatCount(repo.commits)} commits on ${formatCount(repo.days)} days, ${plan.span}`}
              className="relative flex min-w-0 flex-col justify-between gap-8 p-5 md:flex-1 md:px-9 md:py-8"
              style={{
                backgroundColor: plan.background,
                color: plan.foreground,
              }}
            >
              <p aria-hidden="true" className={`${MONO} text-xs uppercase`}>
                Most commits · public repositories
              </p>
              <div aria-hidden="true" className="flex min-w-0 flex-col gap-2">
                <p className="font-display text-[26px] font-extrabold uppercase leading-none md:text-[44px]">
                  The one you kept coming back to.
                </p>
                <p
                  data-role="name"
                  className="min-w-0 font-display font-black leading-[0.82] tracking-[-0.01em] [overflow-wrap:anywhere]"
                  style={{
                    fontSize: `calc(clamp(3rem, 14vw, 9.375rem) * ${plan.nameScale})`,
                    transformOrigin: "0 100%",
                  }}
                >
                  {plan.name}
                </p>
              </div>
              <div
                aria-hidden="true"
                className={`${MONO} flex flex-wrap gap-x-8 gap-y-3 text-[13px]`}
              >
                <Stat value={formatCount(repo.commits)} label="commits" />
                <Stat
                  value={formatCount(repo.days)}
                  label="days with a commit"
                />
                <Stat
                  value={plan.span.replace(" to ", " — ")}
                  label="first to latest"
                />
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
              className="flex min-w-0 flex-col justify-between gap-4 md:w-[520px] md:shrink-0"
            >
              <p
                aria-hidden="true"
                className={`${MONO} text-xs uppercase tracking-[0.06em]`}
              >
                Where your public commits went
              </p>
              <ul className="flex flex-col gap-3.5">
                {plan.bars.map((bar, index) => (
                  <li
                    key={bar.repo}
                    data-item={index}
                    data-group="bars"
                    role="img"
                    aria-label={label(barReading(bar))}
                    className={`flex flex-col gap-1 ${focusRing}`}
                  >
                    <div
                      aria-hidden="true"
                      className={`${MONO} flex items-baseline justify-between gap-3 text-[13px]`}
                    >
                      <span className="min-w-0 truncate font-bold">
                        {bar.name}
                      </span>
                      <span className="tabular-nums">
                        {formatCount(bar.commits)}
                      </span>
                    </div>
                    <div aria-hidden="true" className="h-[18px] bg-ink/[0.08]">
                      <div
                        data-role="fill"
                        className="h-[18px]"
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
              <p
                className={`${MONO} border-t-2 border-ink pt-3 text-xs leading-[1.6]`}
              >
                Public repositories only. Private work counts in your total but
                isn't named here.
              </p>
            </section>
          </div>

          <section
            aria-label="Eras: the repo and language you lived in, year by year"
            className="flex flex-col gap-2.5"
          >
            <p
              aria-hidden="true"
              className={`${MONO} text-xs uppercase tracking-[0.06em]`}
            >
              Eras · the repo and language you lived in, year by year
            </p>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-8">
              {plan.eras.map((era, index) => (
                <li
                  key={era.year}
                  data-item={plan.bars.length + index}
                  data-group="eras"
                  role="img"
                  aria-label={label(eraReading(era))}
                  className={`flex h-[100px] min-w-0 flex-col justify-between px-3.5 py-3 md:h-[120px] ${focusRing}`}
                  style={{
                    backgroundColor: era.background,
                    color: era.foreground,
                    transformOrigin: "50% 0",
                  }}
                >
                  <p
                    aria-hidden="true"
                    className="font-display text-[32px] font-black leading-none"
                  >
                    {era.year}
                  </p>
                  <div
                    aria-hidden="true"
                    className={`${MONO} min-w-0 text-xs leading-normal`}
                  >
                    <p className="truncate font-bold">{era.name}</p>
                    <p className="truncate">
                      {era.language ?? `${formatCount(era.commits)} commits`}
                    </p>
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
