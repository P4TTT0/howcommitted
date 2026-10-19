import type { CSSProperties } from "react";
import { crossingCount } from "@/domain/crossings";
import { formatCount } from "@/features/sequencer/model/format";
import { swatchClass } from "@/features/versus/palette";
import { focusRing } from "@/ui/classes";
import { SceneFrame } from "@/ui/SceneFrame";
import {
  dayReading,
  laneOrder,
  MAX_TICKS,
  niceTicks,
  passesLabel,
  type Race,
  scaleFor,
  yearAtIndex,
} from "./race";

/** The most year labels the timeline prints on a wide screen. */
const MAX_YEAR_LABELS = 14;

/** Where a developer's picture comes from; the initial shows if it fails. */
export function avatarUrl(login: string): string {
  return `https://github.com/${encodeURIComponent(login)}.png?size=96`;
}

/**
 * The versus race, the markup. One bar per developer on a scale that follows
 * whoever is ahead, with their GitHub picture at the tip and the running total
 * beside it. Rows sit at a position by running total and slide when the order
 * changes; each keeps its own node, keyed by login, so that movement can
 * animate. Nothing is numbered or called a winner. The big year, the pass
 * announcement, the timeline of years and the passes so far are all addressed
 * by data attributes from `readout.ts`. This is the finished race; the clock
 * repaints it while playing. On a phone the scene scrolls only if it must.
 */
export function RaceView({ race }: { race: Race }) {
  const last = race.length - 1;
  const totals = race.lanes.map((lane) => lane.total);
  const order = laneOrder(totals);
  const scale = scaleFor(totals);
  const ticks = niceTicks(scale);
  const years = Array.from(
    { length: race.lastYear - race.firstYear + 1 },
    (_, offset) => race.firstYear + offset,
  );
  const everyLabel = Math.ceil(years.length / MAX_YEAR_LABELS);
  const label = `Cumulative contributions from ${race.firstYear} to ${race.lastYear}: ${race.lanes
    .map((lane) => `@${lane.login} ${formatCount(lane.total)}`)
    .join(", ")}`;

  return (
    <div className="absolute inset-0">
      <SceneFrame
        sceneLabel="Race"
        title="The race."
        aside={
          <div className="contents md:flex md:min-w-0 md:items-end md:gap-6">
            <div
              aria-live="polite"
              className="order-last flex min-h-11 min-w-0 basis-full items-center md:order-none md:min-h-0 md:min-w-0 md:basis-auto"
            >
              <p
                data-role="pass"
                hidden
                className="flex max-w-full min-w-0 items-center gap-2 bg-ink px-3 py-2 text-paper md:gap-2.5 md:px-4 md:py-2.5"
              >
                <span
                  data-part="dot"
                  aria-hidden="true"
                  className="size-3 shrink-0 rounded-full md:size-3.5"
                />
                <span
                  data-part="text"
                  className="min-w-0 truncate font-display text-xl font-black uppercase leading-[1.15] md:text-[28px]"
                />
              </p>
            </div>
            <p
              data-role="year"
              aria-hidden="true"
              className="font-display text-[clamp(4.5rem,11vw,10.5rem)] font-black leading-[0.8] tabular-nums"
            >
              {race.lastYear}
            </p>
          </div>
        }
      >
        <section
          aria-label={label}
          className="absolute inset-0 flex flex-col gap-3 overflow-x-hidden overflow-y-auto md:gap-4"
        >
          <div
            className="relative min-h-[calc(var(--n)*80px)] flex-1 [--av:52px] [--lw:0px] [container-type:size] md:min-h-[calc(var(--n)*72px+28px)] md:[--av:clamp(36px,calc((100cqh-28px)/var(--n)*0.62),76px)] md:[--lw:132px] lg:[--lw:180px]"
            style={{ "--n": race.lanes.length } as CSSProperties}
          >
            <div
              aria-hidden="true"
              className="absolute inset-y-0 right-0 left-[calc(var(--lw)+var(--av)/2)] hidden md:block"
            >
              {Array.from({ length: MAX_TICKS }, (_, slot) => {
                const tick = ticks[slot];
                return (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: a fixed pool of gridlines
                    key={slot}
                    data-tick={slot}
                    hidden={!tick}
                    className="absolute inset-y-0"
                    style={{ left: `${(tick?.x ?? 0) * 100}%` }}
                  >
                    <span className="absolute top-0 bottom-7 border-l border-dashed border-ink/20" />
                    <span
                      data-part="label"
                      className="absolute bottom-0 -translate-x-1/2 font-mono text-[11px] [font-stretch:87.5%]"
                    >
                      {tick?.label ?? ""}
                    </span>
                  </div>
                );
              })}
            </div>

            <ul
              data-role="lanes"
              className="absolute inset-x-0 top-0 bottom-0 list-none md:bottom-7"
            >
              {race.lanes.map((lane, index) => {
                const rank = order.indexOf(index);
                const start = lane.firstIndex;
                return (
                  <li
                    key={lane.login.toLowerCase()}
                    data-lane={index}
                    data-login={lane.login}
                    data-rank={rank}
                    className="absolute inset-x-0 top-0 flex h-[calc(100%/var(--n))] flex-col gap-1 transition-transform duration-700 ease-[cubic-bezier(0.65,0,0.35,1)] motion-reduce:transition-none md:flex-row md:items-center md:gap-0"
                    style={
                      {
                        transform: `translateY(${rank * 100}%)`,
                        "--x": (lane.total / scale).toFixed(4),
                      } as CSSProperties
                    }
                  >
                    <div className="flex min-w-0 items-baseline justify-between gap-3 md:w-[var(--lw)] md:shrink-0 md:flex-col md:items-start md:justify-center md:gap-1 md:pr-3">
                      <span className="max-w-full min-w-0 truncate font-mono text-[13px] font-bold [font-stretch:87.5%] md:text-sm">
                        @{lane.login}
                      </span>
                      <span
                        data-lane-value={index}
                        className="shrink-0 font-display text-[32px] font-black leading-none tabular-nums md:hidden"
                      >
                        {formatCount(lane.total)}
                      </span>
                      <span className="hidden font-mono text-[11px] opacity-60 [font-stretch:87.5%] md:block">
                        {start === null
                          ? ""
                          : `since ${yearAtIndex(race, start)}`}
                      </span>
                    </div>

                    <div className="relative ml-[calc(var(--av)/2)] min-h-0 flex-1 md:h-[var(--av)]">
                      <div
                        data-lane-bar={index}
                        className={`absolute top-1/2 left-0 h-[calc(var(--av)*0.85)] w-[calc(var(--x)*100%)] -translate-y-1/2 outline-ink transition-[width] duration-100 ease-linear motion-reduce:transition-none data-[passing]:outline-3 data-[passing]:outline-offset-2 ${swatchClass(index)}`}
                      />
                      <div className="absolute top-1/2 left-[calc(var(--x)*100%)] size-0 transition-[left] duration-100 ease-linear motion-reduce:transition-none">
                        <span
                          className={`absolute flex size-[var(--av)] -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full border-[3px] border-paper font-display text-[24px] leading-none font-black text-paper shadow-[0_0_0_2px_var(--color-ink)] md:border-4 md:text-[calc(var(--av)*0.45)] ${swatchClass(index)}`}
                        >
                          <span aria-hidden="true">
                            {lane.login.slice(0, 1).toUpperCase()}
                          </span>
                          {/* A plain img: github.com is not an allowed next/image host. */}
                          {/** biome-ignore lint/performance/noImgElement: see above */}
                          <img
                            data-avatar={index}
                            src={avatarUrl(lane.login)}
                            alt=""
                            width={96}
                            height={96}
                            draggable={false}
                            className="absolute inset-0 size-full object-cover"
                          />
                        </span>
                        <span
                          data-lane-tip-value={index}
                          aria-hidden="true"
                          className="absolute left-[calc(var(--av)/2+14px)] hidden -translate-y-1/2 font-display text-[clamp(1.25rem,2.8vw,3rem)] font-black leading-none whitespace-nowrap tabular-nums md:block"
                        >
                          {formatCount(lane.total)}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Explore only: `explore.ts` makes it focusable once the scene has ended. */}
            <div
              data-role="scrub"
              hidden
              role="slider"
              tabIndex={-1}
              aria-label="Contributions by date, every developer"
              aria-orientation="horizontal"
              aria-valuemin={0}
              aria-valuemax={Math.max(0, last)}
              aria-valuenow={Math.max(0, last)}
              aria-valuetext={dayReading(race, last)}
              className={`pointer-events-none absolute inset-0 ${focusRing}`}
            />
          </div>

          <div className="flex shrink-0 flex-col gap-2 md:flex-row md:items-center md:gap-4">
            <div
              data-role="years"
              className="grid min-w-0 flex-1 gap-[3px] md:gap-1"
              style={{
                gridTemplateColumns: `repeat(${years.length}, minmax(0, 1fr))`,
              }}
            >
              {years.map((year, offset) => (
                <button
                  key={year}
                  type="button"
                  disabled
                  data-year={year}
                  aria-label={`Jump to ${year}`}
                  className={`flex h-9 min-w-0 flex-col justify-end md:h-11 gap-1.5 disabled:cursor-default ${focusRing}`}
                >
                  <span data-part="bar" className="block h-1.5 bg-ink" />
                  <span
                    data-part="label"
                    className="hidden h-3 font-mono text-[11px] leading-3 [font-stretch:87.5%] md:block"
                  >
                    {offset % everyLabel === 0 ? year : ""}
                  </span>
                </button>
              ))}
            </div>
            <div className="flex justify-between font-mono text-[11px] uppercase [font-stretch:87.5%] md:block md:text-xs md:whitespace-nowrap">
              <span className="md:hidden">{race.firstYear}</span>
              <span data-role="passes" className="tabular-nums">
                {passesLabel(crossingCount(race.crossings, last))}
              </span>
              <span className="md:hidden">{race.lastYear}</span>
            </div>
          </div>
        </section>
      </SceneFrame>
    </div>
  );
}
