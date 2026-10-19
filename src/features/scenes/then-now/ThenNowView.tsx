import { formatCount } from "@/features/sequencer/model/format";
import { focusRing, pressable } from "@/ui/classes";
import { SceneFrame } from "@/ui/SceneFrame";
import {
  AXIS_STEPS,
  barHeight,
  type Comparison,
  dayReading,
  type PanelModel,
  READOUT_IDLE,
  type ThenNowPlan,
  tickLabels,
  WEEKDAY_LABELS,
} from "./plan";

type ThenNowViewProps = { plan: ThenNowPlan };

type Side = "then" | "now";

const MONO = "font-mono [font-stretch:87.5%]";
const GRID_STEPS = [0, 1, 2, 3] as const;

function Chip({ side, model }: { side: Side; model: PanelModel }) {
  return (
    <div
      data-tone={side}
      className="flex min-w-0 items-baseline justify-between gap-2 px-3 py-1.5 md:px-5 md:py-3 lg:flex-col lg:items-stretch lg:justify-between lg:gap-1"
      style={{ backgroundColor: model.background, color: model.foreground }}
    >
      <p
        data-side={side}
        data-role="year"
        className="font-display text-[28px] font-black leading-[0.9] md:text-6xl lg:order-2"
      >
        {model.year}
      </p>
      <p
        data-side={side}
        data-role="tag"
        className={`${MONO} text-right text-[10px] uppercase leading-tight md:text-[11px] lg:order-1 lg:text-left`}
      >
        {model.tag}
      </p>
    </div>
  );
}

/** One number with its label above it, so each column reads on its own. */
function Value({
  side,
  field,
  label,
  model,
  text,
}: {
  side: Side;
  field: string;
  label: string;
  model: PanelModel;
  text: string;
}) {
  return (
    <div
      data-tone={side}
      className="flex min-w-0 flex-col gap-0.5 px-2 py-0.5 md:gap-1 md:px-3 md:py-2"
      style={{ backgroundColor: model.background, color: model.foreground }}
    >
      <p
        className={`${MONO} text-[10px] uppercase leading-none md:text-[11px]`}
      >
        {label}
      </p>
      <p
        data-side={side}
        data-role={field}
        className="font-display text-[22px] font-black leading-none tabular-nums md:text-[34px] lg:text-[32px]"
      >
        {text}
      </p>
    </div>
  );
}

function StatRow({
  field,
  label,
  earlier,
  now,
  format,
}: {
  field: string;
  label: string;
  earlier: PanelModel;
  now: PanelModel;
  format: (model: PanelModel) => string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 md:gap-4">
      <Value
        side="then"
        field={field}
        label={label}
        model={earlier}
        text={format(earlier)}
      />
      <Value
        side="now"
        field={field}
        label={label}
        model={now}
        text={format(now)}
      />
    </div>
  );
}

function LegendItem({ side, model }: { side: Side; model: PanelModel }) {
  return (
    <span className="flex items-center gap-2">
      <span
        data-tone={side}
        aria-hidden="true"
        className="size-3.5 border border-ink"
        style={{ backgroundColor: model.background }}
      />
      <span data-side={side} data-role="legend">
        {model.year}
      </span>
    </span>
  );
}

function Chart({ comparison }: { comparison: Comparison }) {
  const { earlier, now, axisMax } = comparison;
  const ticks = tickLabels(axisMax);
  return (
    <div className="flex min-h-0 min-w-0 flex-col gap-2 md:gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
        <div
          className={`${MONO} flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] uppercase md:gap-x-5 md:text-[11px]`}
        >
          <LegendItem side="then" model={earlier} />
          <LegendItem side="now" model={now} />
          <span className="opacity-60">Share of the year, by weekday</span>
        </div>
        <div
          data-role="readout"
          aria-live="polite"
          className="flex min-h-7 flex-wrap items-baseline gap-x-3 bg-ink px-2.5 py-1 text-paper md:min-h-12 md:gap-x-4 md:px-3.5 md:py-2"
        >
          <span
            data-role="readout-day"
            className="font-display text-sm font-black uppercase leading-none md:text-[26px]"
          >
            {READOUT_IDLE.day}
          </span>
          <span
            data-role="readout-detail"
            className={`${MONO} text-[9px] md:text-xs`}
          >
            {READOUT_IDLE.detail}
          </span>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[1.75rem_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_auto] gap-x-2 md:grid-cols-[2.75rem_minmax(0,1fr)]">
        <div
          aria-hidden="true"
          className={`${MONO} relative mt-2 text-right text-[10px] md:text-[11px]`}
        >
          {GRID_STEPS.map((step) => (
            <span
              key={step}
              data-tick={step}
              className="absolute right-0 translate-y-1/2 leading-none"
              style={{ bottom: `${(step * 100) / AXIS_STEPS}%` }}
            >
              {ticks[step]}
            </span>
          ))}
        </div>
        <div className="relative mt-2 min-h-10 border-ink border-b-2">
          {GRID_STEPS.slice(1).map((step) => (
            <div
              key={step}
              aria-hidden="true"
              className="absolute inset-x-0 border-ink/25 border-t border-dashed"
              style={{ bottom: `${(step * 100) / AXIS_STEPS}%` }}
            />
          ))}
          <div
            data-role="weekdays"
            className="absolute inset-0 grid grid-cols-7 gap-1.5 md:gap-3.5"
          >
            {WEEKDAY_LABELS.map((label, index) => (
              <button
                key={label}
                type="button"
                data-day={index}
                data-state="rest"
                aria-label={dayReading(comparison, index).label}
                className={`flex h-full min-w-0 cursor-pointer items-end justify-center gap-[3px] px-0.5 data-[state=active]:bg-ink/5 data-[state=dim]:opacity-40 md:px-1 ${focusRing}`}
              >
                {[
                  { side: "then", model: earlier },
                  { side: "now", model: now },
                ].map(({ side, model }) => (
                  <span
                    key={side}
                    data-side={side}
                    data-bar={index}
                    className="min-w-0 flex-1 outline outline-1 -outline-offset-1 outline-ink"
                    style={{
                      backgroundColor: model.background,
                      height: `${barHeight(model.week[index] ?? 0, axisMax)}%`,
                      transformOrigin: "50% 100%",
                    }}
                  />
                ))}
              </button>
            ))}
          </div>
        </div>
        <div
          aria-hidden="true"
          className={`${MONO} col-start-2 grid grid-cols-7 gap-1.5 pt-1.5 text-center text-[10px] uppercase leading-none md:gap-3.5 md:pt-2 md:text-xs`}
        >
          {WEEKDAY_LABELS.map((label, index) => (
            <span
              key={label}
              data-day-label={index}
              data-state="rest"
              className="data-[state=active]:font-bold"
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function pickerButtonClass(): string {
  return `h-11 min-w-11 border-2 border-ink px-3 text-xs font-bold md:min-w-18 ${MONO} data-[selected=true]:bg-ink data-[selected=true]:text-paper disabled:cursor-default ${pressable} ${focusRing}`;
}

/**
 * Extra scene: one paired view. Two color chips name the years, three stat
 * rows put the earlier value next to the current one (each number carries its
 * label), and one chart with axes draws each weekday's share of the year with
 * two bars in the same two colors. The weekday groups are buttons: the explore
 * phase lets the viewer read one in the black readout. A neutral line sits
 * under it. The picker buttons are disabled until the explore phase, where
 * `explore.ts` lets the viewer choose the earlier year. Calendar
 * contributions, never commits.
 */
export function ThenNowView({ plan }: ThenNowViewProps) {
  const initial: Comparison = plan.compare(plan.defaultThen);
  const { earlier, now } = initial;
  return (
    <div className="absolute inset-0">
      <SceneFrame
        sceneLabel="Then vs now"
        title="Then vs now."
        note={
          <span
            role="toolbar"
            aria-label="Choose the year to compare with"
            data-role="picker"
            className="flex flex-wrap gap-1.5 md:max-w-[620px] md:justify-end"
          >
            {plan.years.map((year) => (
              <button
                key={year}
                type="button"
                disabled
                data-year={year}
                data-selected={year === plan.defaultThen}
                aria-pressed={year === plan.defaultThen}
                className={pickerButtonClass()}
              >
                {year}
              </button>
            ))}
          </span>
        }
      >
        <div className="absolute inset-0 flex flex-col gap-1.5 md:gap-4">
          <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-2 md:gap-4 lg:grid-cols-[400px_minmax(0,1fr)] lg:grid-rows-1 lg:gap-12">
            <div
              role="img"
              data-role="reading"
              aria-label={`${earlier.reading} ${now.reading}`}
              className="flex min-w-0 flex-col gap-1.5 md:gap-4"
            >
              <div className="grid grid-cols-2 gap-2 md:gap-4">
                <Chip side="then" model={earlier} />
                <Chip side="now" model={now} />
              </div>
              <StatRow
                field="total"
                label="Contributions"
                earlier={earlier}
                now={now}
                format={(model) => formatCount(model.total)}
              />
              <StatRow
                field="days"
                label="Active days"
                earlier={earlier}
                now={now}
                format={(model) => formatCount(model.activeDays)}
              />
              <StatRow
                field="streak"
                label="Longest streak"
                earlier={earlier}
                now={now}
                format={(model) => `${formatCount(model.longestStreak)}d`}
              />
            </div>
            <Chart comparison={initial} />
          </div>
          <p
            data-role="summary"
            aria-live="polite"
            className="bg-ink px-4 py-1.5 font-display text-sm font-extrabold uppercase leading-tight text-paper md:px-[18px] md:py-3 md:text-[28px]"
          >
            {initial.summary}
          </p>
        </div>
      </SceneFrame>
    </div>
  );
}
