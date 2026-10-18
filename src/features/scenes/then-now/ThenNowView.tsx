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

const MONO = "font-mono [font-stretch:87.5%]";
const BIG_NUMBER =
  "font-display text-[40px] font-black leading-[0.9] tabular-nums md:text-[56px]";

function Metric({
  field,
  value,
  label,
}: {
  field: string;
  value: string;
  label: string;
}) {
  return (
    <div className="min-w-0">
      <p data-role={field} className={BIG_NUMBER}>
        {value}
      </p>
      <p className={`${MONO} text-[11px] uppercase`}>{label}</p>
    </div>
  );
}

function Panel({ side, model }: { side: "then" | "now"; model: PanelModel }) {
  return (
    <section
      data-panel={side}
      aria-label={model.reading}
      className="flex min-w-0 flex-col justify-between gap-6 px-5 py-5 md:px-[26px] md:py-[22px]"
      style={{ backgroundColor: model.background, color: model.foreground }}
    >
      <div
        aria-hidden="true"
        className="flex items-baseline justify-between gap-3"
      >
        <p
          data-role="year"
          className="font-display text-5xl font-black leading-[0.9] md:text-7xl"
        >
          {model.year}
        </p>
        <p data-role="tag" className={`${MONO} text-right text-xs uppercase`}>
          {model.tag}
        </p>
      </div>
      <div aria-hidden="true" className="grid grid-cols-3 gap-3">
        <Metric
          field="total"
          value={formatCount(model.total)}
          label="Contributions"
        />
        <Metric
          field="days"
          value={formatCount(model.activeDays)}
          label="Active days"
        />
        <Metric
          field="streak"
          value={`${formatCount(model.longestStreak)}d`}
          label="Longest streak"
        />
      </div>
      <div aria-hidden="true" className="flex flex-col gap-1.5">
        <div className="grid h-24 grid-cols-7 items-end gap-1.5 border-b-2 border-current md:h-[150px]">
          {model.week.map((ratio, index) => (
            <div
              key={WEEKDAY_LABELS[index]}
              data-bar={index}
              className="bg-current"
              style={{
                height: `${Math.round(ratio * 100)}%`,
                transformOrigin: "50% 100%",
              }}
            />
          ))}
        </div>
        <div
          className={`${MONO} grid grid-cols-7 gap-1.5 text-center text-[11px] uppercase`}
        >
          {WEEKDAY_LABELS.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

function pickerButtonClass(): string {
  return `h-10 min-w-11 border-2 border-ink px-3 text-xs font-bold ${MONO} data-[selected=true]:bg-ink data-[selected=true]:text-paper disabled:cursor-default ${pressable} ${focusRing}`;
}

/**
 * Extra scene: two color panels, "then" and "now", with the same four things
 * each (total, active days, longest streak, week shape) and one neutral line
 * under them. The picker buttons are disabled until the explore phase, where
 * `explore.ts` lets the viewer choose the "then" year. Calendar contributions,
 * never commits.
 */
export function ThenNowView({ plan }: ThenNowViewProps) {
  const initial: Comparison = plan.compare(plan.defaultThen);
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
        <div className="absolute inset-0 flex flex-col gap-[18px] overflow-x-hidden overflow-y-auto md:overflow-visible">
          <div className="grid grid-cols-1 gap-4 md:min-h-0 md:flex-1 md:grid-cols-2 md:[&>*]:min-h-0">
            <Panel side="then" model={initial.earlier} />
            <Panel side="now" model={initial.now} />
          </div>
          <p
            data-role="summary"
            aria-live="polite"
            className="bg-ink px-[18px] py-3.5 font-display text-[22px] font-extrabold uppercase leading-tight text-paper md:text-[32px]"
          >
            {initial.summary}
          </p>
        </div>
      </SceneFrame>
    </div>
  );
}
