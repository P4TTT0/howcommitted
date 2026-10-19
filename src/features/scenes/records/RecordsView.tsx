import { formatCount } from "@/features/sequencer/model/format";
import { focusRing } from "@/ui/classes";
import { SceneFrame } from "@/ui/SceneFrame";
import {
  type RecordsPlan,
  streakReading,
  type TileTone,
  tileReading,
} from "./plan";

type RecordsViewProps = { plan: RecordsPlan };

const TONES: Record<TileTone, string> = {
  signal: "bg-block-signal text-ink",
  plain: "bg-transparent text-ink",
  ink: "bg-ink text-paper",
  safety: "bg-block-safety text-ink",
};

/**
 * Scene 5, the markup: the longest streak as a blue hero with one tick per
 * streak day, then the record tiles (4 across, 2 on a phone). The static
 * markup is the finished state; `mount.ts` fills the strip and pops the tiles,
 * `explore.ts` makes the tiles focusable.
 */
export function RecordsView({ plan }: RecordsViewProps) {
  return (
    <div className="absolute inset-0">
      <SceneFrame sceneLabel="Records" title="Records.">
        <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto md:gap-4 md:overflow-visible">
          <section
            aria-label={streakReading(plan)}
            className="flex shrink-0 flex-col gap-2.5 bg-block-ultramarine px-4 py-3 text-paper md:px-6 md:py-3.5"
          >
            <div
              aria-hidden="true"
              className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1"
            >
              <div className="flex flex-wrap items-baseline gap-x-4">
                <p className="font-display text-[clamp(3rem,13vw,4rem)] font-black leading-[1.05] md:text-[clamp(3rem,5vw,5rem)]">
                  {formatCount(plan.streakDays)}{" "}
                  {plan.streakDays === 1 ? "day" : "days"}
                </p>
                <p className="font-display text-[clamp(1.25rem,5vw,1.75rem)] font-extrabold uppercase leading-none">
                  Longest streak
                </p>
              </div>
              <p className="font-mono text-[13px] [font-stretch:87.5%]">
                {plan.streakRange}
              </p>
            </div>
            <div aria-hidden="true" className="flex gap-0.5">
              {plan.ticks.map((opacity, index) => (
                <span
                  // biome-ignore lint/suspicious/noArrayIndexKey: ticks are positional and never reorder
                  key={index}
                  data-tick={index}
                  className="h-4 min-w-0 flex-1 bg-paper"
                  style={{ opacity }}
                />
              ))}
            </div>
          </section>
          <ul
            aria-label="Records"
            className="grid grid-cols-2 gap-3 md:min-h-0 md:flex-1 md:grid-cols-4 md:grid-rows-2 md:gap-4"
          >
            {plan.tiles.map((tile, index) => (
              <li
                key={tile.key}
                data-tile={index}
                aria-label={tileReading(tile)}
                className={`flex min-h-[104px] min-w-0 flex-col justify-between gap-2 border-2 border-ink px-3 py-3 data-[picked]:bg-ink data-[picked]:text-paper md:px-4 md:py-3 ${TONES[tile.tone]} ${focusRing}`}
              >
                <p
                  aria-hidden="true"
                  className="font-mono text-xs uppercase tracking-[0.06em] [font-stretch:87.5%]"
                >
                  {tile.label}
                </p>
                <p
                  aria-hidden="true"
                  className="font-display text-[clamp(1.75rem,8vw,2.75rem)] font-black leading-[1] [overflow-wrap:anywhere] md:text-[clamp(1.75rem,3.4vw,4.5rem)]"
                >
                  {tile.value}
                  {tile.unit ? (
                    <span className="ml-1.5 font-mono text-xs font-normal [font-stretch:87.5%]">
                      {tile.unit}
                    </span>
                  ) : null}
                </p>
                {tile.caption ? (
                  <p
                    aria-hidden="true"
                    className="font-mono text-xs [font-stretch:87.5%] [overflow-wrap:anywhere]"
                  >
                    {tile.caption}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </SceneFrame>
    </div>
  );
}
