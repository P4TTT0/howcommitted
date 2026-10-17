/**
 * Pure instrument data and sample mapping. The recordings are tuned
 * instruments; a note is played from the nearest recorded sample, shifted by
 * a few semitones at most, so nothing is stretched into a chipmunk.
 */

/** MIDI note of scale degree 0 (C4). */
export const ROOT_MIDI = 60;
/** Farthest a sample may be shifted to reach a note. */
export const MAX_SHIFT_SEMITONES = 3;

export type Zone = { file: string; midi: number };

/** Marimba recordings (VSCO 2 CE), C4 to C6. */
export const MARIMBA_ZONES: readonly Zone[] = [
  { file: "marimba-c4", midi: 60 },
  { file: "marimba-g4", midi: 67 },
  { file: "marimba-b4", midi: 71 },
  { file: "marimba-f5", midi: 77 },
  { file: "marimba-c6", midi: 84 },
];

/** Glockenspiel recordings, layered on the highest notes only. */
export const GLOCK_ZONES: readonly Zone[] = [
  { file: "glock-g5", midi: 79 },
  { file: "glock-c6", midi: 84 },
];
/** Lowest note that gets the glockenspiel layer. */
export const GLOCK_MIN_MIDI = 76;

export const CHIP_FILES = ["chip-1", "chip-2", "chip-3"] as const;

export const PAYOFF_FILES = {
  timpaniStep: "timpani-step",
  timpaniFinal: "timpani-final",
  cymbal: "cymbal",
  gong: "gong",
  bellTree: "belltree",
  triangle: "triangle",
} as const;

export function allSampleNames(): string[] {
  return [
    ...MARIMBA_ZONES.map((zone) => zone.file),
    ...GLOCK_ZONES.map((zone) => zone.file),
    ...CHIP_FILES,
    ...Object.values(PAYOFF_FILES),
  ];
}

export type Pick = { zone: Zone; shift: number };

/**
 * The recorded sample closest to `midi` and the semitone shift needed.
 * Ties go to the lower sample, which keeps shifts upward and brighter.
 */
export function nearestZone(midi: number, zones: readonly Zone[]): Pick {
  let best = zones[0];
  if (!best) throw new Error("No zones to pick from");
  for (const zone of zones) {
    if (Math.abs(zone.midi - midi) < Math.abs(best.midi - midi)) best = zone;
  }
  return { zone: best, shift: midi - best.midi };
}

export type SampleFormat = "ogg" | "mp3";

/** Vorbis when the browser can decode it, MP3 otherwise. */
export function pickFormat(
  canPlayType: (type: string) => string,
): SampleFormat {
  return canPlayType('audio/ogg; codecs="vorbis"') === "" ? "mp3" : "ogg";
}
