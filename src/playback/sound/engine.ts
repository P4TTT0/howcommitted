/**
 * Sound engine: a thin facade over the selected kit. The musical plan (what
 * plays and when, pitch momentum, quantization) is the same for every kit;
 * a kit only decides how each hit sounds. Hits arrive pre-aggregated and
 * pre-quantized from the schedule.
 */

import * as Tone from "tone";
import type { Kit, PayoffHit, TickHit } from "./kit";
import { createBubbleKit } from "./kits/bubble";
import { createChipsKit } from "./kits/chips";
import { createMarimbaKit } from "./kits/marimba";
import type { KitId } from "./registry";

export type { PayoffHit, TickHit } from "./kit";

const LOADERS: Record<KitId, (random: () => number) => Promise<Kit>> = {
  bubble: createBubbleKit,
  chips: createChipsKit,
  marimba: createMarimbaKit,
};

export class SoundEngine {
  private constructor(private readonly kit: Kit) {}

  /** Loads a kit's samples and builds its mix. Rejects on failure. */
  static async load(
    kit: KitId,
    random: () => number = Math.random,
  ): Promise<SoundEngine> {
    return new SoundEngine(await LOADERS[kit](random));
  }

  setMuted(muted: boolean): void {
    Tone.getDestination().mute = muted;
  }

  playTick(hit: TickHit): void {
    this.kit.playTick(hit);
  }

  playPayoff(hit: PayoffHit): void {
    this.kit.playPayoff(hit);
  }

  playAccent(time: number): void {
    this.kit.playAccent(time);
  }

  /** Disposes the kit and clears the global mute for the next engine. */
  dispose(): void {
    this.kit.dispose();
    Tone.getDestination().mute = false;
  }
}
