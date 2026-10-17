import type { Ref } from "react";
import type { ClockStatus, PlaybackClock } from "@/playback/clock";
import { actionClass } from "@/ui/classes";

const controlClass = `${actionClass} px-2 sm:px-3 disabled:opacity-40 aria-pressed:bg-ink aria-pressed:text-paper`;

/** The stage ends here: the height of `Controls`, for scenes' parent box. */
export const STAGE_BOTTOM_CLASS = "bottom-[4.75rem]";

type ControlsProps = {
  status: ClockStatus;
  muted: boolean;
  clock: PlaybackClock | undefined;
  onToggleMute: () => void;
  /** Boundaries between scenes, 0..1 along the bar. */
  ticks: readonly number[];
  /** Written by the sequencer on every frame; never by React. */
  fillRef: Ref<HTMLDivElement>;
  /** Spoken value of the bar, for example "Scene 2 of 5: Cumulative line". */
  progressText: string;
  /** Coarse progress (start of the current scene), for assistive tech. */
  progressPercent: number;
};

/** Progress with scene ticks, pause, skip scene and mute: always visible. */
export function Controls({
  status,
  muted,
  clock,
  onToggleMute,
  ticks,
  fillRef,
  progressText,
  progressPercent,
}: ControlsProps) {
  const active = status === "playing" || status === "paused";
  return (
    <div className="absolute inset-x-0 bottom-0 z-50 border-t-2 border-ink bg-paper">
      <div
        role="progressbar"
        aria-label="Playback progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressPercent}
        aria-valuetext={progressText}
        className="relative mx-3 mt-2 h-2 bg-ink/15 sm:mx-4"
      >
        <div ref={fillRef} className="h-full bg-ink" style={{ width: "0%" }} />
        {ticks.map((tick) => (
          <span
            key={tick}
            aria-hidden="true"
            className="absolute top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-ink"
            style={{ left: `${tick * 100}%` }}
          />
        ))}
      </div>
      <div className="flex h-14 items-center gap-2 px-3 sm:px-4">
        <button
          type="button"
          className={controlClass}
          disabled={!active}
          onClick={() =>
            status === "playing" ? clock?.pause() : clock?.resume()
          }
        >
          {status === "paused" ? "Resume" : "Pause"}
        </button>
        <button
          type="button"
          className={controlClass}
          disabled={!active}
          onClick={() => clock?.skip()}
        >
          Skip scene
        </button>
        <button
          type="button"
          className={`${controlClass} ml-auto`}
          aria-pressed={muted}
          onClick={onToggleMute}
        >
          Mute
        </button>
      </div>
    </div>
  );
}
