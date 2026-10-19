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

  // A real switch: the track fills with ink and the knob slides right when on,
  // and the state is spelled out next to it, so it never relies on color alone.
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="Sound"
      onClick={toggle}
      className={`inline-flex min-h-11 items-center gap-2.5 ${pressable} ${focusRing}`}
    >
      <span aria-hidden="true">Sound</span>
      <span
        aria-hidden="true"
        className={`relative inline-block h-7 w-14 border-2 border-ink transition-colors duration-150 motion-reduce:transition-none ${on ? "bg-ink" : "bg-transparent"}`}
      >
        <span
          className={`absolute top-0.5 size-5 transition-[left] duration-150 ease-out motion-reduce:transition-none ${on ? "left-[30px] bg-block-signal" : "left-0.5 bg-ink"}`}
        />
      </span>
      <span aria-hidden="true" className="min-w-[3ch] font-bold">
        {on ? "On" : "Off"}
      </span>
    </button>
  );
}
