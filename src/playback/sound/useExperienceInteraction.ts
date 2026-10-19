import { useEffect } from "react";
import { interaction } from "./interaction";
import { experienceSoundOn, readSoundPreference } from "./preference";

/**
 * Turns the interaction channel on for the experience screens (gate, loading,
 * error) unless the visitor switched sound off. The sequencer takes over once
 * the scenes play.
 */
export function useExperienceInteraction(): void {
  useEffect(() => {
    interaction.setEnabled(experienceSoundOn(readSoundPreference()));
    return () => interaction.setEnabled(false);
  }, []);
}
