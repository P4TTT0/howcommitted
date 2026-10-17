import type { ReactNode, Ref } from "react";
import { focusRing, pressable } from "@/ui/classes";
import { SHORTCUT_KEYS } from "./shortcuts";
import { SPEEDS, type Speed, speedLabel } from "./speed";

/**
 * The stage ends where the controls begin. Two heights: the phone bar has two
 * rows (track, then buttons), from `md` up it is one row.
 */
export const STAGE_BOTTOM_CLASS = "bottom-[6.75rem] md:bottom-[4.25rem]";
const BAR_HEIGHT_CLASS = "h-[6.75rem] md:h-[4.25rem]";

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
  /** Written by the sequencer on every frame; never by React. */
  fillRef: Ref<HTMLDivElement>;
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
  onSpeed: (speed: Speed) => void;
  onCycleSpeed: () => void;
  onMute: () => void;
  onCancel: () => void;
};

/* Every button: 44px at least, flat, mono, with the shared focus ring. */
const base = `inline-flex min-h-11 min-w-11 items-center justify-center gap-2 border-2 font-mono text-xs uppercase ${pressable} ${focusRing}`;
/* Disabled keeps full contrast: a dashed border says "not now". */
const disabled =
  "disabled:cursor-not-allowed disabled:border-dashed disabled:border-ink disabled:bg-transparent disabled:text-ink disabled:active:translate-y-0";
/* Primary: the one thing to press now. Ink, or the block color for Next. */
const primaryInk =
  "h-12 border-ink bg-ink px-3 font-bold text-paper not-disabled:hover:border-block-ultramarine not-disabled:hover:bg-block-ultramarine md:min-w-28";
const primaryBlock =
  "h-12 border-block-ultramarine bg-block-ultramarine px-3 font-bold text-paper not-disabled:hover:border-ink not-disabled:hover:bg-ink md:min-w-28";
/* Secondary: outlined. */
const secondary =
  "h-12 border-ink px-3 not-disabled:hover:bg-ink not-disabled:hover:text-paper";
/* Tertiary: no border until it matters. */
const tertiary =
  "h-11 border-transparent px-2 not-disabled:hover:underline underline-offset-4 aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-paper";

function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      width={14}
      height={14}
      fill="currentColor"
      className="shrink-0"
    >
      {children}
    </svg>
  );
}

const PauseGlyph = (
  <Glyph>
    <path d="M2 1h4v14H2zM10 1h4v14h-4z" />
  </Glyph>
);
const PlayGlyph = (
  <Glyph>
    <path d="M3 0l12 8-12 8z" />
  </Glyph>
);
const PrevGlyph = (
  <Glyph>
    <path d="M2 1h2.5v14H2zM15 0L5.5 8 15 16z" />
  </Glyph>
);
const ReplayGlyph = (
  <Glyph>
    <path
      d="M8 2.5a5.5 5.5 0 1 1-5.2 3.7"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
    />
    <path d="M0.5 1.5l5.5 0.5-3 4.8z" />
  </Glyph>
);
const CloseGlyph = (
  <Glyph>
    <path
      d="M2 2l12 12M14 2L2 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
    />
  </Glyph>
);

/**
 * Everything the user steers with, in one bar at the bottom of the screen.
 *
 * - Primary: Pause while a scene plays; Next once it ends (it turns into the
 *   block color, so the way forward is never missed).
 * - Secondary: previous and next scene, replay, and the speed.
 * - Tertiary: mute and cancel.
 * - The track shows where you are; each scene's segment jumps there.
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
  fillRef,
  progressText,
  progressPercent,
  toggleRef,
  nextRef,
  onToggle,
  onPrev,
  onNext,
  onReplay,
  onJump,
  onSpeed,
  onCycleSpeed,
  onMute,
  onCancel,
}: ControlsProps) {
  const idle = view === "idle";
  const playing = view === "playing";
  const explore = view === "explore";
  const finale = view === "finale";
  const nextIsPrimary = explore;

  return (
    <section
      aria-label="Playback controls"
      className={`absolute inset-x-0 bottom-0 z-50 grid ${BAR_HEIGHT_CLASS} grid-cols-[1fr_2.75rem_2.75rem] grid-rows-[2.75rem_3rem] content-center gap-x-1 gap-y-1 border-t-2 border-ink bg-paper px-3 md:flex md:items-center md:gap-2 md:px-4`}
    >
      <div className="col-start-1 row-start-2 flex items-center gap-1 md:contents">
        <button
          type="button"
          className={`${base} ${secondary} ${disabled}`}
          disabled={!canPrev}
          onClick={onPrev}
          aria-label="Previous scene"
          aria-keyshortcuts={SHORTCUT_KEYS.prev}
          title="Previous scene (←)"
        >
          {PrevGlyph}
          <span className="sr-only">Previous scene</span>
        </button>
        <button
          ref={toggleRef}
          type="button"
          className={`${base} ${playing ? primaryInk : secondary} ${disabled} min-w-0 flex-1 md:flex-none`}
          disabled={idle}
          onClick={explore || finale ? onReplay : onToggle}
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
          {explore || finale ? ReplayGlyph : paused ? PlayGlyph : PauseGlyph}
          {explore || finale ? "Replay" : paused ? "Resume" : "Pause"}
        </button>
        <button
          ref={nextRef}
          type="button"
          className={`${base} ${nextIsPrimary ? primaryBlock : secondary} ${disabled} min-w-0 flex-1 md:flex-none`}
          disabled={!canNext}
          onClick={onNext}
          aria-keyshortcuts={SHORTCUT_KEYS.next}
          title="Next scene (→)"
        >
          Next
          <span className={nextIsPrimary ? "nudge-forward" : undefined}>
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              width={14}
              height={14}
              fill="currentColor"
            >
              <path d="M11.5 1H14v14h-2.5zM1 0l9.5 8L1 16z" />
            </svg>
          </span>
        </button>
      </div>

      <div className="relative col-span-2 col-start-1 row-start-1 h-11 min-w-0 md:order-none md:flex-1">
        <div
          role="progressbar"
          aria-label="Playback progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPercent}
          aria-valuetext={progressText}
          className="absolute inset-x-0 bottom-1.5 h-2 bg-ink/15"
        >
          <div
            ref={fillRef}
            className="h-full bg-ink"
            style={{ width: "0%" }}
          />
          {scenes.slice(1).map(({ id }, tick) => (
            <span
              key={id}
              aria-hidden="true"
              data-scene-tick
              className="absolute top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-ink"
              style={{ left: `${((tick + 1) / scenes.length) * 100}%` }}
            />
          ))}
        </div>
        <ol className="absolute inset-0 flex">
          {scenes.map(({ id, label }, scene) => {
            const current = scene === index && !finale;
            return (
              <li key={id} className="relative min-w-0 flex-1">
                <button
                  type="button"
                  disabled={idle}
                  onClick={() => onJump(scene)}
                  aria-label={`Go to scene ${scene + 1}: ${label}`}
                  aria-current={current ? "step" : undefined}
                  title={label}
                  className={`absolute inset-0 truncate px-1 pb-4 text-left font-mono text-[0.6875rem] uppercase leading-none ${pressable} ${focusRing} not-disabled:hover:bg-ink/10 aria-[current=step]:font-bold disabled:cursor-not-allowed`}
                >
                  <span
                    className={
                      current ? "bg-ink px-1 py-0.5 text-paper" : undefined
                    }
                  >
                    {scene + 1}
                    {current ? ` ${label}${explore ? " · explore" : ""}` : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <button
        type="button"
        className={`${base} ${tertiary} col-start-3 row-start-1 md:hidden`}
        onClick={onCycleSpeed}
        aria-label={`Playback speed ${speedLabel(speed)}. Change speed`}
        title="Playback speed"
      >
        {speedLabel(speed)}
      </button>
      <fieldset className="m-0 hidden min-w-0 items-center border-0 p-0 md:flex">
        <legend className="sr-only">Playback speed</legend>
        {SPEEDS.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={speed === option}
            onClick={() => onSpeed(option)}
            className={`${base} h-11 px-2 not-first:-ml-0.5 border-ink aria-pressed:bg-ink aria-pressed:text-paper not-aria-pressed:hover:bg-ink/10`}
            title={`Playback speed ${speedLabel(option)}`}
          >
            {speedLabel(option)}
          </button>
        ))}
      </fieldset>

      <p
        aria-hidden="true"
        className="hidden whitespace-nowrap font-mono text-[0.6875rem] uppercase xl:block"
      >
        Space · ← → · M · Esc
      </p>

      <button
        type="button"
        className={`${base} ${tertiary} col-start-2 row-start-2`}
        aria-pressed={muted}
        onClick={onMute}
        aria-keyshortcuts={SHORTCUT_KEYS.mute}
        title="Mute (M)"
      >
        Mute
      </button>
      <button
        type="button"
        className={`${base} ${tertiary} col-start-3 row-start-2`}
        onClick={onCancel}
        aria-keyshortcuts={SHORTCUT_KEYS.cancel}
        title="Cancel and go back (Esc)"
      >
        {CloseGlyph}
        <span className="sr-only">Cancel and go back</span>
        <span aria-hidden="true" className="hidden md:inline">
          Cancel
        </span>
      </button>
    </section>
  );
}
