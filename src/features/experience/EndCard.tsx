import Link from "next/link";
import { useEffect, useRef } from "react";
import type { YearBlock } from "@/domain/year-summary";
import { blockForYearIndex } from "@/features/timeline/plan";
import { formatCount } from "@/features/timeline/scene";
import { actionClass } from "@/ui/classes";

export const PRINCIPLE =
  "Commits are not productivity. This is rhythm, not value.";

type EndCardProps = {
  login: string;
  total: number;
  firstYear: number;
  lastYear: number;
  yearBlocks: readonly YearBlock[];
  note: string | null;
  onReplay: () => void;
};

/** One bar per calendar year, height = official commits, color = year identity. */
function YearBars({
  firstYear,
  lastYear,
  yearBlocks,
}: Pick<EndCardProps, "firstYear" | "lastYear" | "yearBlocks">) {
  const commitsByYear = new Map(
    yearBlocks.map((block) => [block.year, block.commits]),
  );
  const years = Array.from(
    { length: lastYear - firstYear + 1 },
    (_, index) => firstYear + index,
  );
  const peak = Math.max(1, ...commitsByYear.values());
  const label = years
    .map((year) => `${year} ${formatCount(commitsByYear.get(year) ?? 0)}`)
    .join(", ");

  return (
    <div>
      <div
        role="img"
        aria-label={`Commits per year: ${label}`}
        className="flex h-20 items-end gap-px border-b-2 border-ink"
      >
        {years.map((year, index) => {
          const colors = blockForYearIndex(index);
          const height = ((commitsByYear.get(year) ?? 0) / peak) * 100;
          return (
            <div
              key={year}
              className="min-w-px flex-1"
              style={{
                height: `${height}%`,
                backgroundColor: colors.background,
              }}
            />
          );
        })}
      </div>
      <div className="mt-1 flex justify-between font-mono text-xs">
        <span>{firstYear}</span>
        <span>{lastYear}</span>
      </div>
    </div>
  );
}

/** The end state: the numbers, the fixed principle line, and what to do next. */
export function EndCard({
  login,
  total,
  firstYear,
  lastYear,
  yearBlocks,
  note,
  onReplay,
}: EndCardProps) {
  const replayRef = useRef<HTMLButtonElement>(null);
  // The scene just ended: move focus to the obvious next action.
  useEffect(() => replayRef.current?.focus(), []);

  const span =
    firstYear === lastYear ? `${firstYear}` : `${firstYear} to ${lastYear}`;
  return (
    <div className="flex min-h-full flex-col justify-between gap-4 p-4">
      <p className="font-mono text-xs uppercase">
        @{login}: {formatCount(total)} commits, {span}
      </p>
      <YearBars
        firstYear={firstYear}
        lastYear={lastYear}
        yearBlocks={yearBlocks}
      />
      <div className="flex flex-col gap-2">
        <p className="font-mono text-xs">{PRINCIPLE}</p>
        {note && <p className="font-mono text-xs leading-4">{note}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          ref={replayRef}
          type="button"
          onClick={onReplay}
          className={`${actionClass} bg-ink text-paper`}
        >
          Replay
        </button>
        <Link href="/" className={actionClass}>
          Search again
        </Link>
      </div>
    </div>
  );
}
