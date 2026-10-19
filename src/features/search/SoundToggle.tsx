"use client";

import { useEffect, useState } from "react";
import { interaction } from "@/playback/sound/interaction";
import {
  landingSoundOn,
  readSoundPreference,
  writeSoundPreference,
} from "@/playback/sound/preference";
import { unlockAudio } from "@/playback/unlock";
import { focusRing, pressable } from "@/ui/classes";

/**
 * The landing's sound switch. Off until the visitor turns it on; the choice is
 * the site-wide preference. Turning it on is the user gesture that unlocks audio.
 */
export function SoundToggle() {
  const [on, setOn] = useState(false);

  // The preference is read after hydration so the server markup stays "off".
  useEffect(() => {
    const wanted = landingSoundOn(readSoundPreference());
    setOn(wanted);
    interaction.setEnabled(wanted);
    // A reload starts locked: the first gesture on the page unlocks audio.
    const unlock = () => void unlockAudio();
    if (wanted) {
      window.addEventListener("pointerdown", unlock, { once: true });
      window.addEventListener("keydown", unlock, { once: true });
    }
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      interaction.setEnabled(false);
    };
  }, []);

  function toggle() {
    const next = !on;
    setOn(next);
    writeSoundPreference(next);
    interaction.setEnabled(next);
    // Called synchronously, so the press still counts as the user gesture.
    if (next) {
      void unlockAudio().then((unlocked) => {
        if (unlocked) interaction.click();
      });
    }
  }

  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={toggle}
      className={`inline-flex min-h-11 items-center underline decoration-1 underline-offset-[3px] hover:text-block-ultramarine ${pressable} ${focusRing}`}
    >
      {on ? "Sound on" : "Sound off"}
    </button>
  );
}
