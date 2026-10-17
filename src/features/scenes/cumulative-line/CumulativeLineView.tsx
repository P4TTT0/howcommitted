import { useMemo } from "react";
import { formatCount } from "@/features/sequencer/model/format";
import {
  blockForYearIndex,
  displayedYearIndex,
  labelledSteps,
  type Plan,
  stepLabel,
  yearReveals,
} from "@/features/sequencer/model/plan";
import { focusRing } from "@/ui/classes";
import {
  CHART_HEIGHT,
  CHART_WIDTH,
  linePath,
  stepLabelPosition,
  stepPath,
  topPercent,
} from "./chart";
import { type FlagMark, flagLabel } from "./scrub";

/** At most this many year labels fit on the axis of a phone. */
const MAX_YEAR_LABELS = 8;

type CumulativeLineViewProps = {
  plan: Plan;
  /** Small honest note shown under the chart. */
  note: string | null;
  /** Repo-creation flags on the line, oldest first. */
  marks: readonly FlagMark[];
};

/**
 * Scene 2, the markup: a year block with the running total above the line
 * chart. Everything that moves is addressed by data attributes from `mount.ts`;
 * the scrub overlay and cursor are for `explore.ts` and stay hidden until then.
 */
export function CumulativeLineView({
  plan,
  note,
  marks,
}: CumulativeLineViewProps) {
  const path = useMemo(() => linePath(plan), [plan]);
  const dashedPath = useMemo(() => stepPath(plan), [plan]);
  const labels = useMemo(() => labelledSteps(plan.steps), [plan]);
  const reveals = useMemo(() => yearReveals(plan), [plan]);
  const firstYear = plan.years[0]?.year ?? 0;
  const lastYear = plan.years.at(-1)?.year ?? firstYear;
  const labelEvery = Math.ceil(plan.years.length / MAX_YEAR_LABELS);
  const chartLabel = `Cumulative contributions from ${firstYear} to ${lastYear}, ${formatCount(plan.total)} in total`;

  return (
    <div className="absolute inset-0">
      <section
        data-role="block"
        className="absolute inset-x-0 top-0 h-[42dvh] overflow-hidden"
      >
        {plan.years.map((span, index) => {
          const colors = blockForYearIndex(index);
          return (
            <div
              key={span.year}
              data-year-layer={index}
              className="absolute inset-0 flex flex-col justify-between p-4 landscape:flex-row landscape:items-end"
              style={{
                backgroundColor: colors.background,
                color: colors.foreground,
                clipPath: index === 0 ? undefined : "inset(0% 100% 0% 0%)",
              }}
            >
              <p className="font-display text-[min(26vw,15dvh)] font-black leading-[0.8] landscape:text-[min(15vw,34dvh)]">
                {span.year}
              </p>
              <div className="landscape:text-right">
                <p
                  data-role="total"
                  className="font-display text-[min(26vw,15dvh)] font-black leading-[0.8] tabular-nums landscape:text-[min(15vw,34dvh)]"
                >
                  0
                </p>
                <p className="mt-4 font-mono text-xs uppercase">
                  Contributions
                </p>
              </div>
            </div>
          );
        })}
      </section>

      <div className="absolute inset-x-0 bottom-0 top-[42dvh] flex flex-col px-4 pb-2 pt-6">
        <div className="relative min-h-0 flex-1">
          <svg
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
            role="img"
            aria-label={chartLabel}
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
            const { leftPercent, topPercent } = stepLabelPosition(plan, step);
            return (
              <span
                key={step.year}
                data-step-label={step.progress}
                data-visible="false"
                className="invisible absolute max-w-[55%] bg-paper px-1 font-mono text-xs data-[visible=true]:visible"
                style={{
                  left: `${leftPercent}%`,
                  top: `${topPercent}%`,
                  transform: `translate(${leftPercent > 55 ? "-100%" : "0"}, -50%)`,
                }}
              >
                {stepLabel(step)}
              </span>
            );
          })}
          {marks.map((mark, index) => {
            const left = mark.progress * 100;
            const top = topPercent(plan, plan.cumulative[mark.dayIndex] ?? 0);
            return (
              <span key={`${mark.name}-${mark.date}`}>
                <svg
                  aria-hidden="true"
                  data-flag={index}
                  data-at={mark.progress}
                  data-visible="false"
                  viewBox="0 0 14 22"
                  width={14}
                  height={22}
                  fill="currentColor"
                  className="invisible absolute -translate-y-full data-[visible=true]:visible"
                  style={{ left: `${left}%`, top: `${top}%` }}
                >
                  <path d="M0 0h2.5v22H0zM2.5 1h11l-3.5 4 3.5 4h-11z" />
                </svg>
                <span
                  data-flag-label={index}
                  data-visible="false"
                  className="invisible absolute max-w-[60%] bg-paper px-1 font-mono text-xs data-[visible=true]:visible"
                  style={{
                    left: `${left}%`,
                    top: `${top}%`,
                    transform: `translate(${left > 55 ? "-100%" : "1rem"}, calc(-100% - 1.6rem))`,
                  }}
                >
                  {flagLabel(mark)}
                </span>
              </span>
            );
          })}
          <span
            data-role="head"
            className="absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink"
            style={{ left: "0%", top: "100%" }}
          />
          {plan.years.map((span) => (
            <div
              key={span.year}
              className="absolute inset-y-0 w-px bg-ink/15"
              style={{ left: `${span.startProgress * 100}%` }}
            />
          ))}
          <div
            data-role="cursor"
            hidden
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
          >
            <span
              data-cursor-line
              className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-ink"
            />
            <span
              data-cursor-dot
              className="absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-paper bg-ink"
            />
            <p
              data-cursor-chip
              className="absolute top-0 bg-ink px-2 py-1 font-mono text-xs text-paper"
            >
              <span data-chip-date className="block" />
              <span data-chip-total className="block font-bold" />
            </p>
          </div>
          {/* Explore only: `explore.ts` shows it once the scene has ended. */}
          <div
            data-role="scrub"
            hidden
            role="slider"
            tabIndex={-1}
            aria-label="Cumulative contributions by date"
            aria-orientation="horizontal"
            aria-valuemin={0}
            aria-valuemax={Math.max(0, plan.days.length - 1)}
            aria-valuenow={Math.max(0, plan.days.length - 1)}
            aria-valuetext={`${formatCount(plan.total)} contributions in total`}
            className={`absolute inset-0 touch-none ${focusRing}`}
          />
        </div>
        <div className="relative h-5 font-mono text-xs">
          {plan.years.map((span, index) =>
            index % labelEvery === 0 ? (
              <span
                key={span.year}
                className="absolute top-1"
                style={{ left: `${span.startProgress * 100}%` }}
              >
                {span.year}
              </span>
            ) : null,
          )}
        </div>
        {note && <p className="font-mono text-xs leading-4">{note}</p>}
      </div>

      {plan.milestones.map((milestone, index) => {
        const colors = blockForYearIndex(
          displayedYearIndex(reveals, milestone.time),
        );
        return (
          <div
            key={milestone.time}
            data-flood={index}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center"
            style={{
              backgroundColor: colors.background,
              color: colors.foreground,
              transform: "scaleY(0)",
              transformOrigin: "50% 100%",
            }}
          >
            <span
              data-flood-number
              className="font-display text-[min(34vw,36dvh)] font-black leading-[0.8] tabular-nums"
            >
              {formatCount(milestone.value)}
            </span>
            <span className="mt-4 font-mono text-sm uppercase">
              Contributions
            </span>
          </div>
        );
      })}
    </div>
  );
}
