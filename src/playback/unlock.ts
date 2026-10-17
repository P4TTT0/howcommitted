/**
 * Audio unlock that outlives a page transition. The AudioContext belongs to
 * the document, so a click on the landing page keeps it running after a
 * client-side navigation; a fresh load (shared link, reload) starts locked.
 * Sound must never start without such a gesture.
 *
 * Tone.js is loaded lazily so the landing page does not pay for it up front:
 * `preloadAudio()` runs on input focus, and `unlockAudio()` then calls
 * `Tone.start()` synchronously inside the click. If the click wins the race,
 * it awaits the import instead (Safari may then refuse the resume; the
 * experience falls back to its own start button in that case).
 */

type ToneModule = typeof import("tone");

let tone: ToneModule | null = null;
let loading: Promise<ToneModule> | null = null;
let unlocked = false;

/** Starts loading Tone.js. Safe to call any number of times. */
export function preloadAudio(): Promise<ToneModule> {
  loading ??= import("tone").then(
    (module) => {
      tone = module;
      return module;
    },
    (error: unknown) => {
      loading = null;
      throw error;
    },
  );
  return loading;
}

async function resume(module: ToneModule): Promise<boolean> {
  try {
    // Runs synchronously up to this call, so it still counts as the gesture.
    await module.start();
    unlocked = module.getContext().state === "running";
  } catch {
    unlocked = false;
  }
  return unlocked;
}

/** Resumes the AudioContext. Call synchronously from a user gesture handler. */
export function unlockAudio(): Promise<boolean> {
  if (tone) return resume(tone);
  return preloadAudio().then(resume, () => false);
}

/** True only when a previous gesture left the AudioContext running. */
export function isAudioUnlocked(): boolean {
  return unlocked && tone !== null && tone.getContext().state === "running";
}
