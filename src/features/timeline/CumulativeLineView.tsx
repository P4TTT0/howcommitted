import { useMemo } from "react";
import {
  CHART_HEIGHT,
  CHART_WIDTH,
  linePath,
  stepLabelPosition,
  stepPath,
} from "./chart";
import { formatCount } from "./format";
import {
  blockForYearIndex,
  displayedYearIndex,
  labelledSteps,
  type Plan,
  stepLabel,
  yearReveals,
} from "./plan";

/** At most this many year labels fit on the axis of a phone. */
const MAX_YEAR_LABELS = 8;

type CumulativeLineViewProps = {
  plan: Plan;
  /** Small honest note shown under the chart. */
  note: string | null;
};

/**
 * Scene 2, the markup: a year block with the running total above the line
 * chart. Everything that moves is addressed by data attributes from `mount.ts`.
 */
export function CumulativeLineView({ plan, note }: CumulativeLineViewProps) {
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
