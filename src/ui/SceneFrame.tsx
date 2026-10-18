import type { ReactNode } from "react";
import { labelClass } from "./classes";

type SceneFrameProps = {
  /** Right side of the header, for example "Week shape". */
  sceneLabel: string;
  /** The big headline. */
  title?: ReactNode;
  /** Mono note on the right of the title row. */
  note?: ReactNode;
  children: ReactNode;
  className?: string;
};

/**
 * The shared scene layout: a header row, an optional title block, then the
 * content. 48px above and 64px at the sides on desktop, 16px gutters on a
 * phone, 18px between the parts. The controls bar sits below it.
 */
export function SceneFrame({
  sceneLabel,
  title,
  note,
  children,
  className = "",
}: SceneFrameProps) {
  return (
    <div
      className={`flex h-full min-w-0 flex-col gap-[18px] px-4 pt-6 pb-4 md:px-16 md:pt-12 ${className}`}
    >
      <header className="flex items-baseline justify-between gap-4">
        <p className="font-display text-[28px] font-black uppercase tracking-[0.02em]">
          Committed
        </p>
        <p className={`text-right ${labelClass}`}>{sceneLabel}</p>
      </header>
      {(title || note) && (
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          {title && (
            <h2 className="font-display text-[clamp(2.5rem,8vw,5.5rem)] font-black uppercase leading-[0.86]">
              {title}
            </h2>
          )}
          {note && (
            <p className="font-mono text-[13px] leading-[1.6] [font-stretch:87.5%] md:text-right">
              {note}
            </p>
          )}
        </div>
      )}
      <div className="relative min-h-0 flex-1">{children}</div>
    </div>
  );
}

type ReadoutBoxProps = {
  title: ReactNode;
  detail?: ReactNode;
  className?: string;
};

/** The black readout: a big title and one mono detail line, for explore values. */
export function ReadoutBox({ title, detail, className = "" }: ReadoutBoxProps) {
  return (
    <div className={`bg-ink px-[18px] py-3.5 text-paper ${className}`}>
      <p className="font-display text-[30px] font-black uppercase leading-none md:text-4xl">
        {title}
      </p>
      {detail && (
        <p className="mt-1 font-mono text-xs [font-stretch:87.5%]">{detail}</p>
      )}
    </div>
  );
}
