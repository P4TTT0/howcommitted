import { formatCount } from "@/features/sequencer/model/format";
import { focusRing, pressable } from "@/ui/classes";
import { SceneFrame } from "@/ui/SceneFrame";
import {
  type Comparison,
  type PanelModel,
  type ThenNowPlan,
  WEEKDAY_LABELS,
} from "./plan";

type ThenNowViewProps = { plan: ThenNowPlan };

type Side = "then" | "now";

const MONO = "font-mono [font-stretch:87.5%]";
const VALUE =
  "min-w-0 px-2 py-1 font-display text-[22px] font-black leading-none tabular-nums md:px-3 md:py-1.5 md:text-[34px] lg:text-[36px]";

function Chip({ side, model }: { side: Side; model: PanelModel }) {
  return (
    <div
      data-tone={side}
      className="flex min-w-0 items-baseline justify-between gap-2 px-3 py-2 md:px-5 md:py-3 lg:flex-col lg:items-stretch lg:justify-between lg:gap-1"
      style={{ backgroundColor: model.background, color: model.foreground }}
    >
      <p
        data-side={side}
        data-role="year"
        className="font-display text-[28px] font-black leading-[0.9] md:text-6xl lg:text-7xl"
      >
        {model.year}
      </p>
      <p
        data-side={side}
        data-role="tag"
        className={`${MONO} text-right text-[10px] uppercase leading-tight md:text-[11px] lg:text-left`}
      >
        {model.tag}
      </p>
    </div>
  );
}

function Value({
  side,
  field,
  model,
  text,
}: {
  side: Side;
  field: string;
  model: PanelModel;
  text: string;
}) {
  return (
    <p
      data-tone={side}
      data-side={side}
      data-role={field}
      className={VALUE}
      style={{ backgroundColor: model.background, color: model.foreground }}
    >
      {text}
    </p>
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
    <div className="flex min-w-0 flex-col gap-1">
      <p className={`${MONO} text-[11px] uppercase leading-none`}>{label}</p>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <Value
          side="then"
          field={field}
          model={earlier}
          text={format(earlier)}
        />
        <span className="font-display text-lg font-black md:text-3xl">
          {"→"}
        </span>
        <Value side="now" field={field} model={now} text={format(now)} />
      </div>
    </div>
  );
}

function Chart({ earlier, now }: { earlier: PanelModel; now: PanelModel }) {
  return (
    <div className="flex min-h-0 min-w-0 flex-col gap-1">
      <div className="relative min-h-14 flex-1 bg-ink">
        <div className="absolute inset-x-2 top-2 bottom-0 grid grid-cols-7 gap-2">
          {WEEKDAY_LABELS.map((label, index) => (
            <div key={label} className="flex h-full items-end gap-[3px]">
              {[
                { side: "then", model: earlier },
                { side: "now", model: now },
              ].map(({ side, model }) => (
                <div
                  key={side}
                  data-side={side}
                  data-bar={index}
                  className="min-w-0 flex-1"
                  style={{
                    backgroundColor: model.background,
                    height: `${Math.round((model.week[index] ?? 0) * 100)}%`,
                    transformOrigin: "50% 100%",
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div
        className={`${MONO} grid grid-cols-7 gap-2 px-2 text-center text-[11px] uppercase leading-none`}
      >
        {WEEKDAY_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </div>
  );
}

function pickerButtonClass(): string {
  return `h-11 min-w-11 border-2 border-ink px-3 text-xs font-bold ${MONO} data-[selected=true]:bg-ink data-[selected=true]:text-paper disabled:cursor-default ${pressable} ${focusRing}`;
}

/**
 * Extra scene: one paired view. Two color chips name the years, three stat
 * rows put the earlier value next to the current one, and one chart draws each
 * weekday with two bars in the same two colors. A neutral line sits under it.
 * The picker buttons are disabled until the explore phase, where `explore.ts`
 * lets the viewer choose the earlier year. Calendar contributions, never
 * commits.
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
        <div className="absolute inset-0 flex flex-col gap-2 md:gap-4">
          <div
            role="img"
            data-role="reading"
            aria-label={`${earlier.reading} ${now.reading}`}
            className="flex min-h-0 flex-1 flex-col gap-2 md:gap-4"
          >
            <div className="grid grid-cols-2 gap-2 md:gap-4">
              <Chip side="then" model={earlier} />
              <Chip side="now" model={now} />
            </div>
            <div className="grid min-h-0 flex-1 gap-2 md:gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-6">
              <div className="flex min-w-0 flex-col justify-between gap-1.5 md:gap-4">
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
              <Chart earlier={earlier} now={now} />
            </div>
          </div>
          <p
            data-role="summary"
            aria-live="polite"
            className="bg-ink px-4 py-2 font-display text-base font-extrabold uppercase leading-tight text-paper md:px-[18px] md:py-3.5 md:text-[32px]"
          >
            {initial.summary}
          </p>
        </div>
      </SceneFrame>
    </div>
  );
}
