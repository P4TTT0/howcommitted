/**
 * Interaction channel: `hover(level)` and `click()` for pointer events, which
 * fire at any time and so are NOT on the playback clock. Never used for
 * scheduled sound.
 *
 * Plays only when sound is on (the sequencer's Sound button drives
 * `setEnabled`; off by default) and only after a user gesture unlocked the
 * AudioContext. Hover is quiet, throttled and skips repeats of one target.
 * Tone.js is loaded lazily, so importing this costs nothing up front.
 */

import { isAudioUnlocked } from "../unlock";
import { allowHover, type HoverGate, hoverRate } from "./gestures";

export type InteractionSound = "hover" | "click";

export type InteractionDeps = {
  now: () => number;
  isUnlocked: () => boolean;
  play: (sound: InteractionSound, rate: number, db: number) => void;
};

const HOVER_DB = -20;
const CLICK_DB = -12;

export type InteractionChannel = {
  /** Same switch as the Sound button: false silences everything. */
  setEnabled(enabled: boolean): void;
  /** Quiet blip whose pitch encodes `level` (0..1). `target` dedupes repeats. */
  hover(level: number, target?: string): void;
  /** Any press. */
  click(): void;
  /** Forgets the last hover target, e.g. when the pointer leaves the chart. */
  leave(): void;
};

export function createInteractionChannel(
  deps: InteractionDeps,
): InteractionChannel {
  let enabled = false;
  let last: HoverGate = { at: Number.NEGATIVE_INFINITY, target: null };
  const ready = () => enabled && deps.isUnlocked();
  return {
    setEnabled(value) {
      enabled = value;
    },
    hover(level, target) {
      if (!ready()) return;
      const now = deps.now();
      if (!allowHover(now, last, target ?? null)) return;
      last = { at: now, target: target ?? null };
      deps.play("hover", hoverRate(level), HOVER_DB);
    },
    click() {
      if (!ready()) return;
      deps.play("click", 1, CLICK_DB);
    },
    leave() {
      last = { ...last, target: null };
    },
  };
}

type Player = (sound: InteractionSound, rate: number, db: number) => void;

let player: Promise<Player> | null = null;

/** Loads Tone and the two samples once; the first press after unlock pays. */
function loadPlayer(): Promise<Player> {
  player ??= (async (): Promise<Player> => {
    const [Tone, samples] = await Promise.all([
      import("tone"),
      import("./samples"),
    ]);
    const buffers = await samples.loadSamples(["hover", "click"]);
    const out = new Tone.Limiter(-1).toDestination();
    const pool: import("./samples").Pool = [];
    return (sound, rate, db) =>
      samples.playSample(pool, 3, out, buffers.get(sound), {
        time: Tone.now(),
        rate,
        db,
      });
  })().catch((error: unknown) => {
    player = null;
    throw error;
  });
  return player;
}

/** The app-wide channel. Wire `setEnabled` to the Sound button. */
export const interaction: InteractionChannel = createInteractionChannel({
  now: () => performance.now(),
  isUnlocked: isAudioUnlocked,
  play: (sound, rate, db) => {
    loadPlayer().then(
      (play) => play(sound, rate, db),
      () => {},
    );
  },
});
