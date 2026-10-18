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
      <SceneFrame
        sceneLabel="Records"
        title="Records."
        note={
          <>
            Your own marks, from the contribution calendar.
            <br />
            {plan.yearsNote}
          </>
        }
      >
        <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto">
          <section
            aria-label={streakReading(plan)}
            className="flex shrink-0 flex-col gap-3.5 bg-block-ultramarine px-5 py-4 text-paper md:px-7 md:py-[22px]"
          >
            <div
              aria-hidden="true"
              className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1"
            >
              <div className="flex flex-wrap items-baseline gap-x-5">
                <p className="font-display text-[clamp(3.5rem,9vw,7rem)] font-black leading-[0.82]">
                  {formatCount(plan.streakDays)}{" "}
                  {plan.streakDays === 1 ? "day" : "days"}
                </p>
                <p className="font-display text-[clamp(1.5rem,3vw,2.25rem)] font-extrabold uppercase">
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
                  className="h-[22px] min-w-0 flex-1 bg-paper"
                  style={{ opacity }}
                />
              ))}
            </div>
          </section>
          <ul
            aria-label="Records"
            className="grid min-h-0 flex-1 grid-cols-2 gap-3 md:grid-cols-4 md:gap-4"
          >
            {plan.tiles.map((tile, index) => (
              <li
                key={tile.key}
                data-tile={index}
                aria-label={tileReading(tile)}
                className={`flex min-h-[116px] min-w-0 flex-col justify-between gap-2 border-2 border-ink px-3.5 py-3 data-[picked]:bg-ink data-[picked]:text-paper md:px-5 md:py-4 ${TONES[tile.tone]} ${focusRing}`}
              >
                <p
                  aria-hidden="true"
                  className="font-mono text-xs uppercase tracking-[0.06em] [font-stretch:87.5%]"
                >
                  {tile.label}
                </p>
                <p
                  aria-hidden="true"
                  className="font-display text-[clamp(2.25rem,5.5vw,4.5rem)] font-black leading-[0.9]"
                >
                  {tile.value}
                </p>
                <p
                  aria-hidden="true"
                  className="font-mono text-xs [font-stretch:87.5%]"
                >
                  {tile.note}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </SceneFrame>
    </div>
  );
}
