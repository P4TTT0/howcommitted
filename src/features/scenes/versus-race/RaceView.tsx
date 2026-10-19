import { crossingCount, crossingsUpTo } from "@/domain/crossings";
import { formatCount } from "@/features/sequencer/model/format";
import { swatchClass } from "@/features/versus/palette";
import { focusRing, labelClass, pressable } from "@/ui/classes";
import { SceneFrame } from "@/ui/SceneFrame";
import {
  axisLabels,
  dayReading,
  laneOrder,
  type Race,
  type RaceMode,
  whenLabel,
} from "./race";
import { CROSSING_SLOTS, SUBTITLES } from "./readout";

const MODES: readonly { mode: RaceMode; label: string }[] = [
  { mode: "calendar", label: "Calendar years" },
  { mode: "age", label: "Same age" },
];

/** One stable key per readout slot (there are `CROSSING_SLOTS` of them). */
const CROSSING_IDS = ["latest-3", "latest-2", "latest-1"].slice(
  0,
  CROSSING_SLOTS,
);

/** Minimum height of one lane (label, gap, bar) so five of them always fit. */
const LANE_MIN_PX = 44;

/**
 * The versus race, the markup: one lane per developer, ordered by the running
 * total at each moment (no ranks, no numbers), a bar per lane on one shared
 * scale, the running year above, the lines crossed so far below and a shared
 * time axis. The toggle between calendar years and same age is disabled until
 * the explore phase, like the other pickers. Everything that moves is
 * addressed by data attributes from `readout.ts`; the scrub overlay is for
 * `explore.ts`. On a phone the scene scrolls vertically if it must; nothing
 * ever scrolls sideways.
 */
export function RaceView({ race }: { race: Race }) {
  const finalOrder = laneOrder(race.lanes.map((lane) => lane.total));
  const latest = crossingsUpTo(race.crossings, race.length - 1, CROSSING_SLOTS);
  const crossed = crossingCount(race.crossings, race.length - 1);
  const label = `Cumulative contributions from ${race.firstYear} to ${race.lastYear}: ${race.lanes
    .map((lane) => `@${lane.login} ${formatCount(lane.total)}`)
    .join(", ")}`;

  return (
    <div className="absolute inset-0">
      <SceneFrame
        sceneLabel="Race"
        title="The race."
        note={<span data-role="subtitle">{SUBTITLES[race.mode]}</span>}
      >
        <section
          aria-label={label}
          className="absolute inset-0 flex flex-col gap-3 overflow-x-hidden overflow-y-auto md:gap-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div
              role="toolbar"
              aria-label="Time axis"
              data-role="modes"
              className="flex"
            >
              {MODES.map(({ mode, label: text }, index) => (
                <button
                  key={mode}
                  type="button"
                  disabled
                  data-mode={mode}
                  aria-pressed={mode === race.mode}
                  className={`min-h-11 border-2 border-ink px-3 font-mono text-xs font-bold uppercase tracking-[0.06em] [font-stretch:87.5%] disabled:cursor-default aria-pressed:bg-ink aria-pressed:text-paper md:px-4 ${index > 0 ? "-ml-0.5" : ""} ${pressable} ${focusRing}`}
                >
                  {text}
                </button>
              ))}
            </div>
            <p
              data-role="year"
              aria-hidden="true"
              className="font-display text-[clamp(2.75rem,12vw,6rem)] font-black leading-[0.8] tabular-nums"
            >
              {race.mode === "age" ? "Year 1" : race.lastYear}
            </p>
          </div>

          <div
            className="relative flex min-h-0 flex-1 flex-col"
            style={{ minHeight: race.lanes.length * LANE_MIN_PX + 40 }}
          >
            <ul
              data-role="lanes"
              className="flex min-h-0 flex-1 flex-col gap-2"
            >
              {finalOrder.map((index) => {
                const lane = race.lanes[index];
                if (!lane) return null;
                return (
                  <li
                    key={lane.login.toLowerCase()}
                    data-lane={index}
                    className="flex min-h-0 flex-1 flex-col gap-1"
                    style={{ minHeight: LANE_MIN_PX - 8 }}
                  >
                    <div className="flex items-baseline justify-between gap-3 font-mono text-xs [font-stretch:87.5%]">
                      <span className="min-w-0 truncate font-bold">
                        @{lane.login}
                      </span>
                      <span
                        data-lane-value={index}
                        className="shrink-0 tabular-nums"
                      >
                        {formatCount(lane.total)}
                      </span>
                    </div>
                    <div className="min-h-3 flex-1 border-2 border-ink">
                      <div
                        data-lane-bar={index}
                        className={`h-full ${swatchClass(index)}`}
                        style={{ width: `${(lane.total / race.peak) * 100}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="relative mt-1 h-6 shrink-0 overflow-x-clip border-t-2 border-ink font-mono text-xs [font-stretch:87.5%]">
              <div data-role="marks" aria-hidden="true">
                {axisLabels(race).map((mark) => (
                  <span
                    key={mark.label}
                    className="absolute top-1"
                    style={{ left: `${mark.startProgress * 100}%` }}
                  >
                    {mark.label}
                  </span>
                ))}
              </div>
              <span
                data-role="playhead"
                aria-hidden="true"
                className="absolute -top-0.5 h-3 w-1 -translate-x-1/2 bg-ink"
                style={{ left: "100%" }}
              />
            </div>
            {/* Explore only: `explore.ts` shows it once the scene has ended. */}
            <div
              data-role="scrub"
              hidden
              role="slider"
              tabIndex={-1}
              aria-label="Contributions by date, every developer"
              aria-orientation="horizontal"
              aria-valuemin={0}
              aria-valuemax={Math.max(0, race.length - 1)}
              aria-valuenow={Math.max(0, race.length - 1)}
              aria-valuetext={dayReading(race, race.length - 1)}
              className={`absolute inset-0 touch-pan-y ${focusRing}`}
            />
          </div>

          <p
            data-role="date"
            aria-hidden="true"
            className="font-mono text-xs tabular-nums [font-stretch:87.5%]"
          >
            {race.mode === "age" ? "Day 1" : `${race.lastYear}`}
          </p>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <p className={labelClass}>
              Lines crossed
              <span data-role="crossing-count" className="tabular-nums">
                {crossed > 0 ? ` · ${formatCount(crossed)}` : ""}
              </span>
            </p>
            <p
              data-role="crossing-none"
              hidden={latest.length > 0}
              className="font-mono text-xs [font-stretch:87.5%]"
            >
              None yet
            </p>
            {CROSSING_IDS.map((id, slot) => {
              const crossing = latest[slot];
              return (
                <p
                  key={id}
                  data-crossing={slot}
                  hidden={!crossing}
                  className="flex max-w-full min-w-0 items-center gap-2 border-2 border-ink px-3 py-1.5 font-mono text-xs [font-stretch:87.5%]"
                >
                  <span data-part="when" className="shrink-0 font-bold">
                    {crossing ? whenLabel(race, crossing.index) : ""}
                  </span>
                  <span
                    data-part="dot"
                    aria-hidden="true"
                    className={`size-2.5 shrink-0 rounded-full ${swatchClass(crossing?.passer ?? 0)}`}
                  />
                  <span data-part="text" className="min-w-0 truncate">
                    {crossing
                      ? `@${race.lanes[crossing.passer]?.login} passes @${race.lanes[crossing.passed]?.login}`
                      : ""}
                  </span>
                </p>
              );
            })}
          </div>
        </section>
      </SceneFrame>
    </div>
  );
}
