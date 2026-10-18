import type { Ref } from "react";
import { focusRing, labelClass, pressable } from "@/ui/classes";
import { SHORTCUT_KEYS } from "./shortcuts";
import { speedLabel } from "./speed";

/**
 * The stage ends where the controls begin. Two heights: the phone bar has
 * three rows (ticks, then two rows of buttons), from `md` up it is one row.
 */
export const STAGE_BOTTOM_CLASS = "bottom-[10.25rem] md:bottom-[5.375rem]";
const BAR_HEIGHT_CLASS = "h-[10.25rem] md:h-[5.375rem]";

/** What the bar is showing. */
export type ControlsView = "idle" | "playing" | "explore" | "finale";

export type ControlsProps = {
  view: ControlsView;
  /** The clock is paused (only meaningful while playing). */
  paused: boolean;
  muted: boolean;
  speed: number;
  /** Labels of the scenes, in order, for the clickable track. */
  scenes: readonly { id: string; label: string }[];
  /** The scene shown (the last one on the finale). */
  index: number;
  canPrev: boolean;
  canNext: boolean;
  /** The bar; the sequencer mirrors the clock position on it as `data-progress`. */
  trackRef: Ref<HTMLDivElement>;
  /** Spoken value of the bar, for example "Scene 2 of 5: Cumulative line". */
  progressText: string;
  /** Coarse progress (start of the current scene), for assistive tech. */
  progressPercent: number;
  toggleRef?: Ref<HTMLButtonElement>;
  nextRef?: Ref<HTMLButtonElement>;
  onToggle: () => void;
  onPrev: () => void;
  onNext: () => void;
  onReplay: () => void;
  onJump: (index: number) => void;
  onCycleSpeed: () => void;
  onMute: () => void;
  onCancel: () => void;
};

/* Every button: 44px, flat, transparent, 2px ink border, mono label. */
const button = `inline-flex h-11 min-w-0 items-center justify-center whitespace-nowrap border-2 border-ink bg-transparent px-4 ${labelClass} ${pressable} ${focusRing}`;
/* Disabled keeps full contrast: a dashed border says "not now". */
const disabled =
  "disabled:cursor-not-allowed disabled:border-dashed disabled:bg-transparent disabled:text-ink disabled:active:translate-y-0";
/* The one thing to press next: ink-filled. */
const primary = "bg-ink px-6 font-bold text-paper";

/**
 * Everything the user steers with, in one bar under the scene: Exit, Prev,
 * Replay, one tick per scene (each jumps there), the speed, the sound, and
 * the primary Next. At phone width the ticks take their own row.
 */
export function Controls({
  view,
  paused,
  muted,
  speed,
  scenes,
  index,
  canPrev,
  canNext,
  trackRef,
  progressText,
  progressPercent,
  toggleRef,
  nextRef,
  onToggle,
  onPrev,
  onNext,
  onReplay,
  onJump,
  onCycleSpeed,
  onMute,
  onCancel,
}: ControlsProps) {
  const idle = view === "idle";
  const explore = view === "explore";
  const finale = view === "finale";
  const replays = explore || finale;
  const upcoming = scenes[index + 1]?.label ?? "Finale";

  return (
    <section
      aria-label="Playback controls"
      className={`absolute inset-x-4 bottom-0 z-50 flex ${BAR_HEIGHT_CLASS} flex-col gap-2 border-t-2 border-ink bg-paper pt-3 pb-3 md:inset-x-16 md:flex-row md:items-center md:gap-3 md:pt-4 md:pb-6`}
    >
      <div className="flex gap-2 md:contents">
        <button
          type="button"
          className={`${button} flex-1 px-3 md:flex-none md:px-4`}
          onClick={onCancel}
          aria-keyshortcuts={SHORTCUT_KEYS.cancel}
          aria-label="Cancel and go back"
          title="Cancel and go back (Esc)"
        >
          <span aria-hidden="true">Exit</span>
        </button>
        <button
          type="button"
          className={`${button} ${disabled} flex-1 md:flex-none`}
          disabled={!canPrev}
          onClick={onPrev}
          aria-label="Previous scene"
          aria-keyshortcuts={SHORTCUT_KEYS.prev}
          title="Previous scene (←)"
        >
          <span aria-hidden="true">← Prev</span>
        </button>
        <button
          ref={toggleRef}
          type="button"
          className={`${button} ${disabled} flex-1 md:flex-none`}
          disabled={idle}
          onClick={replays ? onReplay : onToggle}
          aria-keyshortcuts={SHORTCUT_KEYS.toggle}
          title={
            explore
              ? "Replay this scene (Space)"
              : finale
                ? "Replay from the start"
                : paused
                  ? "Resume (Space)"
                  : "Pause (Space)"
          }
        >
          {replays ? "Replay" : paused ? "Resume" : "Pause"}
        </button>
      </div>

      <div className="relative order-first h-8 min-w-0 md:order-none md:h-11 md:flex-1">
        <div
          ref={trackRef}
          role="progressbar"
          data-progress="0"
          aria-label="Playback progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPercent}
          aria-valuetext={progressText}
          className="absolute inset-0 flex items-center gap-1"
        >
          {scenes.map(({ id }, scene) => (
            <span
              key={id}
              aria-hidden="true"
              data-scene-tick
              className="h-2 min-w-0 flex-1 bg-ink"
              style={{ opacity: finale || scene <= index ? 1 : 0.18 }}
            />
          ))}
        </div>
        <ol className="absolute inset-0 flex gap-1">
          {scenes.map(({ id, label }, scene) => (
            <li key={id} className="min-w-0 flex-1">
              <button
                type="button"
                disabled={idle}
                onClick={() => onJump(scene)}
                aria-label={`Go to scene ${scene + 1}: ${label}`}
                aria-current={scene === index && !finale ? "step" : undefined}
                title={label}
                className={`h-full w-full ${pressable} ${focusRing} not-disabled:hover:bg-ink/10 disabled:cursor-not-allowed`}
              />
            </li>
          ))}
        </ol>
      </div>

      <div className="flex gap-2 md:contents">
        <button
          type="button"
          className={`${button} px-3 md:px-4`}
          onClick={onCycleSpeed}
          aria-label={`Playback speed ${speedLabel(speed)}. Change speed`}
          title="Playback speed"
        >
          {speedLabel(speed)}
        </button>
        <button
          type="button"
          className={`${button} px-3 md:px-4`}
          aria-keyshortcuts={SHORTCUT_KEYS.mute}
          title="Mute (M)"
          onClick={onMute}
        >
          {muted ? "Sound off" : "Sound on"}
        </button>
        <button
          ref={nextRef}
          type="button"
          className={`${button} ${primary} ${disabled} min-w-0 flex-1 md:flex-none`}
          disabled={!canNext}
          onClick={onNext}
          aria-keyshortcuts={SHORTCUT_KEYS.next}
          title="Next scene (→)"
        >
          <span className="truncate">
            {finale ? "Next →" : `Next: ${upcoming} →`}
          </span>
        </button>
      </div>
    </section>
  );
}
