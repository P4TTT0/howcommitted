import { useMemo } from "react";
import { formatCount } from "@/features/sequencer/model/format";
import {
  blockForYearIndex,
  labelledSteps,
  type Plan,
  stepLabel,
} from "@/features/sequencer/model/plan";
import { focusRing } from "@/ui/classes";
import { ReadoutBox, SceneFrame } from "@/ui/SceneFrame";
import {
  CHART_HEIGHT,
  CHART_WIDTH,
  linePath,
  stepLabelPosition,
  stepPath,
  topPercent,
} from "./chart";
import { type FlagMark, flagLabel } from "./scrub";
import { slotX, type YearSlot, yearName, yearReading } from "./years";

/** At most this many year labels fit on the axis of a phone. */
const MAX_YEAR_LABELS = 8;
/** The tallest block takes this share of the plot; the line uses all of it. */
const BLOCK_PEAK_PERCENT = 50;

type TimelineViewProps = {
  login: string;
  plan: Plan;
  slots: readonly YearSlot[];
  /** Small honest note shown under the chart. */
  note: string | null;
  /** Repo-creation flags on the line, oldest first. */
  marks: readonly FlagMark[];
};

/**
 * Scene 1, the markup: the big counter, then yearly blocks under the running
 * total line, with repo-creation flags. Everything that moves is addressed by
 * data attributes from `mount.ts`; the cursor, readout and scrub overlay are
 * for `explore.ts` and stay hidden until then. The static markup is the
 * finished state.
 */
export function TimelineView({
  login,
  plan,
  slots,
  note,
  marks,
}: TimelineViewProps) {
  const xOf = useMemo(
    () => (progress: number) => slotX(slots, progress),
    [slots],
  );
  const path = useMemo(() => linePath(plan, xOf), [plan, xOf]);
  const dashedPath = useMemo(() => stepPath(plan, xOf), [plan, xOf]);
  const labels = useMemo(() => labelledSteps(plan.steps), [plan]);
  const first = slots[0];
  const last = slots.at(-1);
  const labelEvery = Math.ceil(slots.length / MAX_YEAR_LABELS);
  const summary = slots
    .map((slot) => `${yearName(slot)} ${formatCount(slot.contributions)}`)
    .join(", ");
  const total = formatCount(plan.total);

  return (
    <div className="absolute inset-0">
      <SceneFrame sceneLabel="Timeline">
        <div className="absolute inset-0 flex flex-col gap-[18px]">
          <div className="flex shrink-0 items-end justify-between gap-12">
            <div className="flex min-w-0 flex-col">
              <p className="font-mono text-[13px] uppercase tracking-[0.06em] [font-stretch:87.5%] md:text-sm">
                @{login} · {first?.year} — {last?.year}
              </p>
              <p
                data-role="total"
                aria-hidden="true"
                className="font-display text-[min(22vw,17dvh)] font-black leading-[0.82] tracking-[-0.01em] tabular-nums"
              >
                {total}
              </p>
              <p className="font-display text-[clamp(1.5rem,4.4vw,3rem)] font-extrabold uppercase leading-none">
                Contributions so far.
              </p>
            </div>
            <ul
              aria-label="How to read the chart"
              className="hidden max-w-[360px] flex-col gap-2.5 font-mono text-[13px] leading-normal [font-stretch:87.5%] lg:flex"
            >
              <li className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className="size-[18px] shrink-0 bg-block-ultramarine"
                />
                Blocks: each year's contributions
              </li>
              <li className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className="h-1 w-[18px] shrink-0 bg-ink"
                />
                Line: the running total
              </li>
              {marks.length > 0 && (
                <li className="flex items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className="mx-2 h-[18px] w-0.5 shrink-0 bg-ink"
                  />
                  Flag: a repository is born
                </li>
              )}
            </ul>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="relative min-h-0 flex-1 border-b-2 border-ink">
              {slots.map((slot, index) => {
                const colors = blockForYearIndex(slot.colorIndex);
                return (
                  <div
                    key={slot.year}
                    className="absolute inset-y-0"
                    style={{
                      left: `${(index / slots.length) * 100}%`,
                      width: `${100 / slots.length}%`,
                    }}
                  >
                    <div
                      data-bar={index}
                      className={`absolute inset-x-0.5 bottom-0 md:inset-x-1 ${slot.inProgress ? "border-2 border-dashed" : ""}`}
                      style={{
                        height: `${slot.ratio * BLOCK_PEAK_PERCENT}%`,
                        minHeight: slot.contributions > 0 ? "2px" : undefined,
                        backgroundColor: slot.inProgress
                          ? undefined
                          : colors.background,
                        borderColor: colors.background,
                        transformOrigin: "50% 100%",
                      }}
                    >
                      {slot.inProgress && (
                        <span
                          aria-hidden="true"
                          className="absolute inset-0 opacity-45"
                          style={{ backgroundColor: colors.background }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}

              <svg
                viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                preserveAspectRatio="none"
                className="absolute inset-0 h-full w-full"
                role="img"
                aria-label={`Contributions per year: ${summary}. ${total} in total.`}
              >
                <defs>
                  <clipPath id="reveal">
                    <rect
                      data-role="clip"
                      x="0"
                      y="0"
                      width="0"
                      height={CHART_HEIGHT}
                    />
                  </clipPath>
                </defs>
                <path
                  d={path}
                  clipPath="url(#reveal)"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
                {/* Contributions no day carries: dashed, so it reads as not a day. */}
                <path
                  d={dashedPath}
                  clipPath="url(#reveal)"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="5"
                  strokeDasharray="12 10"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>

              {labels.map((step) => {
                const { leftPercent, topPercent: top } = stepLabelPosition(
                  plan,
                  step,
                  xOf,
                );
                return (
                  <span
                    key={step.year}
                    data-step-label={step.progress}
                    data-visible="false"
                    className="invisible absolute max-w-[55%] bg-paper px-1 font-mono text-xs data-[visible=true]:visible"
                    style={{
                      left: `${leftPercent}%`,
                      top: `${top}%`,
                      transform: `translate(${leftPercent > 55 ? "-100%" : "0"}, -50%)`,
                    }}
                  >
                    {stepLabel(step)}
                  </span>
                );
              })}

              {marks.map((mark, index) => {
                const left = xOf(mark.progress) * 100;
                const top = topPercent(
                  plan,
                  plan.cumulative[mark.dayIndex] ?? 0,
                );
                return (
                  <span
                    key={`${mark.name}-${mark.date}`}
                    data-flag={index}
                    data-at={mark.progress}
                    data-visible="false"
                    className="invisible absolute data-[visible=true]:visible"
                    style={{ left: `${left}%`, top: `${top}%` }}
                  >
                    <span className="sr-only">{flagLabel(mark)}</span>
                    <span
                      aria-hidden="true"
                      className="absolute bottom-0 h-11 w-0.5 -translate-x-1/2 bg-ink"
                    />
                    <span
                      aria-hidden="true"
                      className={`absolute bottom-[34px] max-w-[40vw] truncate bg-paper/90 px-1 font-mono text-xs ${left > 70 ? "right-1.5" : "left-1.5"}`}
                    >
                      {mark.name}
                    </span>
                  </span>
                );
              })}

              <span
                data-role="head"
                aria-hidden="true"
                className="absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink"
                style={{
                  left: "100%",
                  top: `${topPercent(plan, plan.total)}%`,
                }}
              />

              {/* Explore only: `explore.ts` shows these once the scene has ended. */}
              <div
                data-role="cursor"
                hidden
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
              >
                <span
                  data-cursor-line
                  className="absolute inset-y-0 w-0 -translate-x-1/2 border-l-[1.5px] border-dashed border-ink"
                />
                <span
                  data-cursor-dot
                  className="absolute size-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-ink bg-paper"
                />
                <div data-cursor-readout className="absolute top-3 min-w-56">
                  <ReadoutBox
                    title={<span data-readout-year />}
                    detail={<span data-readout-detail />}
                  />
                </div>
              </div>
              <div
                data-role="scrub"
                hidden
                role="slider"
                tabIndex={-1}
                aria-label="Contributions by year"
                aria-orientation="horizontal"
                aria-valuemin={0}
                aria-valuemax={Math.max(0, slots.length - 1)}
                aria-valuenow={Math.max(0, slots.length - 1)}
                aria-valuetext={last ? yearReading(last) : ""}
                className={`absolute inset-0 touch-none ${focusRing}`}
              />
            </div>

            <div
              aria-hidden="true"
              className="relative mt-1 h-5 shrink-0 font-mono text-xs"
            >
              {slots.map((slot, index) =>
                index % labelEvery === 0 ? (
                  <span
                    key={slot.year}
                    className="absolute top-0 whitespace-nowrap"
                    style={{
                      left: `${(index / slots.length) * 100}%`,
                      paddingLeft: 2,
                    }}
                  >
                    {slot.inProgress ? (
                      <>
                        <span className="md:hidden">{slot.year}</span>
                        <span className="hidden md:inline">
                          {yearName(slot)}
                        </span>
                      </>
                    ) : (
                      slot.year
                    )}
                  </span>
                ) : null,
              )}
            </div>
            {note && (
              <p className="mt-1 shrink-0 font-mono text-xs leading-4">
                {note}
              </p>
            )}
          </div>
        </div>
      </SceneFrame>
    </div>
  );
}
