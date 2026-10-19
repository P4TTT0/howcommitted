import type { PlaybackClock } from "../clock";
import type { SoundEngine } from "./engine";
import { countTicks, fillTicks } from "./gestures";

type Clock = Pick<PlaybackClock, "at">;
type Engine = () => Pick<
  SoundEngine,
  "fillTick" | "countTick" | "countClose"
> | null;

/**
 * Expands a bar fill into single ticks, each one an event on the clock at
 * `start + offset`. Nothing is started on the audio context ahead of time, so
 * every tick pauses, resumes, seeks and cancels with the Transport.
 * `from`/`to` (0..1) place the fill on one longer climb.
 */
export function scheduleFill(
  clock: Clock,
  engine: Engine,
  start: number,
  duration: number,
  {
    db = 0,
    from = 0,
    to = 1,
  }: { db?: number; from?: number; to?: number } = {},
): void {
  for (const { offset, rate } of fillTicks(duration, from, to)) {
    clock.at(start + offset, (time) => engine()?.fillTick(time, rate, db));
  }
}

/**
 * Expands a count into `steps` ticks over `duration` plus the closing hit at
 * `start + duration`, all as clock events.
 */
export function scheduleCount(
  clock: Clock,
  engine: Engine,
  start: number,
  duration: number,
  steps: number,
): void {
  for (const { offset, progress } of countTicks(duration, steps)) {
    clock.at(start + offset, (time) => engine()?.countTick(time, progress));
  }
  clock.at(start + Math.max(0, duration), (time) => engine()?.countClose(time));
}
