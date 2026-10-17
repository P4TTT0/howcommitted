import type { ClockStatus, PlaybackClock } from "@/playback/clock";
import { actionClass } from "@/ui/classes";

const controlClass = `${actionClass} px-2 sm:px-3 disabled:opacity-40 aria-pressed:bg-ink aria-pressed:text-paper`;

type ControlsProps = {
  status: ClockStatus;
  muted: boolean;
  clock: PlaybackClock | undefined;
  onToggleMute: () => void;
};

/** Pause, skip, replay and mute: always visible, always working. */
export function Controls({
  status,
  muted,
  clock,
  onToggleMute,
}: ControlsProps) {
  const active = status === "playing" || status === "paused";
  return (
    <div className="absolute inset-x-0 bottom-0 z-50 flex h-14 items-center gap-2 border-t-2 border-ink bg-paper px-3 sm:px-4">
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
        Skip
      </button>
      <button
        type="button"
        className={controlClass}
        disabled={status === "idle"}
        onClick={() => clock?.restart()}
      >
        Replay
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
  );
}
