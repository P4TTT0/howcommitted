"use client";

import { useEffect, useState } from "react";
import { swatchClass } from "@/features/versus/palette";
import { interaction } from "@/playback/sound/interaction";
import { SceneFrame } from "@/ui/SceneFrame";
import {
  dayCount,
  rangeText,
  type Span,
  type StreakRow,
  type StreaksPlan,
  spanLevel,
} from "./plan";

/** Most year labels the axis of a phone holds. */
const MAX_YEAR_LABELS = 6;

/** A label starting past this percent would run out of the axis. */
const LAST_LABEL_AT = 90;

/** Half the widest tooltip, so its centre can be kept inside the track. */
const TIP_HALF = "7.5rem";

const SIDE_CLASS = "sm:w-[210px] sm:shrink-0 lg:w-[250px]";

/** A thin 4px scrollbar: ink thumb, transparent track, no arrows. */
const SCROLL_CSS = `
.streaks-scroll{scrollbar-width:thin;scrollbar-color:var(--color-ink) transparent}
.streaks-scroll::-webkit-scrollbar{width:4px;height:4px}
.streaks-scroll::-webkit-scrollbar-track{background:transparent}
.streaks-scroll::-webkit-scrollbar-thumb{background:var(--color-ink)}
.streaks-scroll::-webkit-scrollbar-button{display:none;width:0;height:0}
`;

type Kind = "streak" | "quiet";
type Pick = { row: number; kind: Kind } | null;

function Legend() {
  return (
    <span className="flex flex-wrap items-center gap-x-5 gap-y-1.5 [font-stretch:87.5%] md:justify-end">
      <span className="flex items-center gap-2">
        <span aria-hidden="true" className="h-3.5 w-[22px] shrink-0 bg-ink" />
        In a row
      </span>
      <span className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="h-3.5 w-[22px] shrink-0 border-2 border-dashed border-ink"
        />
        Quiet
      </span>
      <span className="hidden items-center gap-2 md:flex">
        <span
          aria-hidden="true"
          className="h-3.5 w-[22px] shrink-0 bg-ink/20"
        />
        Active months
      </span>
    </span>
  );
}

function titleOf(kind: Kind, span: Span): string {
  return kind === "streak"
    ? `${dayCount(span.days)} in a row`
    : `${dayCount(span.days)} quiet`;
}

function labelOf(login: string, kind: Kind, span: Span): string {
  return `@${login}: ${titleOf(kind, span)}, ${rangeText(span.start, span.end)}`;
}

type RowProps = {
  row: StreakRow;
  position: number;
  picked: Kind | null;
  dimmed: boolean;
  onPick: (kind: Kind) => void;
};

function Row({ row, position, picked, dimmed, onPick }: RowProps) {
  const shown = picked === "streak" ? row.streak : row.quiet;
  const center = shown ? shown.left + shown.width / 2 : 0;
  return (
    <li
      data-reveal={row.index}
      className={`flex shrink-0 flex-col gap-1.5 border-b border-ink/20 py-2 transition-opacity sm:min-h-[88px] sm:flex-1 sm:basis-0 sm:shrink sm:flex-row sm:items-center sm:gap-6 sm:py-1 ${dimmed ? "opacity-45" : ""}`}
    >
      <div
        className={`flex min-w-0 items-baseline justify-between gap-3 sm:flex-col sm:items-start sm:justify-start sm:gap-0.5 ${SIDE_CLASS}`}
      >
        <p className="flex min-w-0 items-center gap-2 font-mono text-xs font-bold [font-stretch:87.5%]">
          <span
            aria-hidden="true"
            className={`size-3 shrink-0 rounded-full ${swatchClass(row.index)}`}
          />
          <span className="min-w-0 [overflow-wrap:anywhere]">@{row.login}</span>
        </p>
        <p className="flex shrink-0 items-baseline gap-[0.2em] font-display text-4xl font-black leading-[0.9] sm:text-[clamp(2.25rem,4.5vw,5rem)]">
          <span>
            {row.streak ? row.streak.days.toLocaleString("en-US") : "No run"}
          </span>
          {row.streak && (
            <span className="text-[0.4em] leading-none">
              {row.streak.days === 1 ? "day" : "days"}
            </span>
          )}
        </p>
      </div>
      <div className="relative h-16 min-w-0 flex-1 sm:h-auto sm:self-stretch">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 inset-y-[22%] sm:inset-y-[20%]"
        >
          {row.months.map((bar) => (
            <span
              key={bar.month}
              className={`absolute bottom-0 opacity-25 ${swatchClass(row.index)}`}
              style={{
                left: `${bar.left}%`,
                width: `${bar.width}%`,
                height: `${bar.level * 100}%`,
              }}
            />
          ))}
        </div>
        {row.quiet && (
          <button
            type="button"
            data-streak-button
            data-block="quiet"
            aria-label={labelOf(row.login, "quiet", row.quiet)}
            onMouseEnter={() => onPick("quiet")}
            onMouseLeave={() => interaction.leave()}
            onFocus={() => onPick("quiet")}
            onClick={() => onPick("quiet")}
            className={`absolute inset-y-[14%] min-w-2 cursor-pointer border-2 border-dashed border-ink p-0 ${picked === "quiet" ? "bg-ink/10" : "bg-transparent"}`}
            style={{
              left: `${row.quiet.left}%`,
              width: `${row.quiet.width}%`,
            }}
          />
        )}
        {row.streak && (
          <button
            type="button"
            data-streak-button
            data-block="streak"
            aria-label={labelOf(row.login, "streak", row.streak)}
            onMouseEnter={() => onPick("streak")}
            onMouseLeave={() => interaction.leave()}
            onFocus={() => onPick("streak")}
            onClick={() => onPick("streak")}
            className={`absolute inset-y-[6%] min-w-2.5 cursor-pointer border-0 p-0 outline-offset-2 ${swatchClass(row.index)} ${picked === "streak" ? "outline outline-2 outline-ink" : ""}`}
            style={{
              left: `${row.streak.left}%`,
              width: `${row.streak.width}%`,
            }}
          />
        )}
        {picked && shown && (
          <div
            role="tooltip"
            className={`pointer-events-none absolute z-10 whitespace-nowrap bg-ink px-3 py-2 text-paper ${position === 0 ? "top-[calc(100%-6px)]" : "bottom-[calc(100%-6px)]"}`}
            style={{
              left: `clamp(${TIP_HALF}, ${center}%, calc(100% - ${TIP_HALF}))`,
              transform: "translateX(-50%)",
            }}
          >
            <p className="font-display text-[22px] font-black uppercase leading-none">
              {titleOf(picked, shown)}
            </p>
            <p className="mt-1 font-mono text-[11px] [font-stretch:87.5%]">
              {rangeText(shown.start, shown.end)}
            </p>
          </div>
        )}
      </div>
    </li>
  );
}

/** Narrowest bar drawn, in percent of the track, so a short stretch shows. */
const MIN_BAR = 3;

function phoneDetail(row: StreakRow): string {
  const parts: string[] = [];
  if (row.streak) {
    parts.push(
      `${dayCount(row.streak.days)} in a row: ${rangeText(row.streak.start, row.streak.end)}`,
    );
  }
  if (row.quiet) {
    parts.push(
      `${dayCount(row.quiet.days)} quiet: ${rangeText(row.quiet.start, row.quiet.end)}`,
    );
  }
  return parts.join("; ");
}

type PhoneRowProps = {
  row: StreakRow;
  maxStreak: number;
  maxQuiet: number;
  open: boolean;
  onToggle: () => void;
};

/** A phone row: the number, then both bars on one scale for the whole lineup. */
function PhoneRow({ row, maxStreak, maxQuiet, open, onToggle }: PhoneRowProps) {
  const detail = phoneDetail(row);
  return (
    <li
      data-reveal={row.index}
      className="shrink-0 border-b border-ink/20 first:border-t"
    >
      <button
        type="button"
        data-phone-row
        aria-expanded={open}
        aria-label={`@${row.login}: ${detail || "no run"}`}
        onClick={onToggle}
        className={`flex min-h-11 w-full cursor-pointer flex-col gap-1.5 py-1.5 text-left ${open ? "bg-ink/5" : ""}`}
      >
        <span className="flex items-baseline justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2 font-mono text-[13px] font-bold [font-stretch:87.5%]">
            <span
              aria-hidden="true"
              className={`size-2.5 shrink-0 rounded-full ${swatchClass(row.index)}`}
            />
            <span className="min-w-0 [overflow-wrap:anywhere]">
              @{row.login}
            </span>
          </span>
          <span className="flex shrink-0 items-baseline gap-[0.2em] font-display text-[32px] font-black leading-[0.9]">
            <span>
              {row.streak ? row.streak.days.toLocaleString("en-US") : "No run"}
            </span>
            {row.streak && (
              <span className="text-base leading-none">
                {row.streak.days === 1 ? "day" : "days"}
              </span>
            )}
          </span>
        </span>
        <span aria-hidden="true" className="flex flex-col gap-1">
          <span className="block h-3.5">
            {row.streak && (
              <span
                data-block="streak"
                className={`block h-full ${swatchClass(row.index)}`}
                style={{
                  width: `${Math.max(MIN_BAR, (row.streak.days / maxStreak) * 100)}%`,
                }}
              />
            )}
          </span>
          <span className="block h-2.5">
            {row.quiet && (
              <span
                data-block="quiet"
                className="box-border block h-full border-2 border-dashed border-ink"
                style={{
                  width: `${Math.max(MIN_BAR, (row.quiet.days / maxQuiet) * 100)}%`,
                }}
              />
            )}
          </span>
        </span>
        {open && detail && (
          <span className="font-mono text-[11px] [font-stretch:87.5%]">
            {detail}
          </span>
        )}
      </button>
    </li>
  );
}

/**
 * Versus scene 5, the markup: one shared year axis, then a row per developer
 * (in the order they were added) with their activity month by month, their
 * longest run of days in a row (solid) and longest quiet stretch (dashed).
 * Hovering, focusing or tapping a block names it and dims the other rows. A
 * phone stacks the numbers over the timeline.
 */
export function StreaksView({ plan }: { plan: StreaksPlan }) {
  const labelEvery = Math.ceil(plan.years.length / MAX_YEAR_LABELS);
  const [pick, setPick] = useState<Pick>(null);
  const [openRow, setOpenRow] = useState(-1);
  const maxStreak = Math.max(1, ...plan.rows.map((r) => r.streak?.days ?? 0));
  const maxQuiet = Math.max(1, ...plan.rows.map((r) => r.quiet?.days ?? 0));

  useEffect(() => {
    if (!pick) return;
    const away = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (!target?.closest("[data-streak-button]")) setPick(null);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [pick]);

  return (
    <div className="absolute inset-0">
      <style>{SCROLL_CSS}</style>
      <SceneFrame
        sceneLabel="Streaks"
        title="Longest streaks."
        note={<Legend />}
      >
        <section
          aria-label="Longest streaks of each developer"
          className="flex h-full min-h-0 flex-col gap-3"
        >
          {plan.privateNote && <p className="sr-only">{plan.privateNote}</p>}
          <ul className="streaks-scroll flex min-h-0 flex-1 flex-col overflow-y-auto md:hidden">
            {plan.rows.map((row, position) => (
              <PhoneRow
                key={row.login.toLowerCase()}
                row={row}
                maxStreak={maxStreak}
                maxQuiet={maxQuiet}
                open={openRow === position}
                onToggle={() =>
                  setOpenRow(openRow === position ? -1 : position)
                }
              />
            ))}
          </ul>
          <div className="hidden gap-6 md:flex" aria-hidden="true">
            <div className={`hidden ${SIDE_CLASS} sm:block`} />
            <div className="relative h-6 min-w-0 flex-1 border-b-2 border-ink font-mono text-[11px] [font-stretch:87.5%]">
              {plan.years.map((year, index) =>
                index % labelEvery === 0 && year.left <= LAST_LABEL_AT ? (
                  <span
                    key={year.year}
                    className="absolute top-0"
                    style={{ left: `${year.left}%` }}
                  >
                    {year.year}
                  </span>
                ) : null,
              )}
            </div>
          </div>
          <ul
            className="streaks-scroll hidden min-h-0 flex-1 flex-col overflow-y-auto md:flex"
            onMouseLeave={() => setPick(null)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setPick(null);
              }
            }}
          >
            {plan.rows.map((row, position) => (
              <Row
                key={row.login.toLowerCase()}
                row={row}
                position={position}
                picked={pick?.row === position ? pick.kind : null}
                dimmed={pick !== null && pick.row !== position}
                onPick={(kind) => {
                  setPick({ row: position, kind });
                  const span = kind === "streak" ? row.streak : row.quiet;
                  if (span) {
                    interaction.hover(
                      spanLevel(plan, span.days),
                      `${row.login}:${kind}`,
                    );
                  }
                }}
              />
            ))}
          </ul>
          {plan.callout && (
            <div
              data-reveal={plan.rows.length}
              className="shrink-0 bg-ink px-3.5 py-2.5 text-paper sm:px-[18px] sm:py-3"
            >
              <p className="min-w-0 font-display text-xl font-extrabold uppercase leading-none [overflow-wrap:anywhere] sm:text-[28px]">
                {plan.callout}
              </p>
            </div>
          )}
        </section>
      </SceneFrame>
    </div>
  );
}
