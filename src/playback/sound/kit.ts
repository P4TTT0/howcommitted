/** What every sound kit can play. The musical plan is the same for all. */

export type TickHit = {
  /** Audio time from the Transport callback. */
  time: number;
  /** Semitones above the root note (C4). */
  semitones: number;
  /** 0..1 */
  intensity: number;
};

export type PayoffHit = {
  time: number;
  kind: "step" | "final";
};

export type Kit = {
  playTick(hit: TickHit): void;
  playPayoff(hit: PayoffHit): void;
  /** Soft marker for a year change. */
  playAccent(time: number): void;
  dispose(): void;
};
