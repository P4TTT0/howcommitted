import * as Tone from "tone";

/**
 * Audio unlock that outlives a page transition. The AudioContext belongs to
 * the document, so a click on the landing page keeps it running after a
 * client-side navigation; a fresh load (shared link, reload) starts locked.
 * Sound must never start without such a gesture.
 */

let unlocked = false;

/** Resumes the AudioContext. Call synchronously from a user gesture handler. */
export async function unlockAudio(): Promise<boolean> {
  try {
    await Tone.start();
    unlocked = Tone.getContext().state === "running";
  } catch {
    unlocked = false;
  }
  return unlocked;
}

/** True only when a previous gesture left the AudioContext running. */
export function isAudioUnlocked(): boolean {
  // Short-circuit so a locked page never creates an AudioContext just to ask.
  return unlocked && Tone.getContext().state === "running";
}
