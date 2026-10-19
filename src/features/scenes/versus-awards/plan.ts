import { AWARD_COUNT, type Award, buildAwards } from "@/domain/versus-awards";
import {
  privateNoteFor,
  type VersusProfile,
} from "@/features/versus/versusProfiles";

export type AwardCard = Award & {
  login: string;
};

export type AwardsPlan = {
  awards: AwardCard[];
  /** "Picked from 12 possible awards." */
  note: string;
  /** Set when shared private contributions are part of the days. */
  privateNote: string | null;
};

/**
 * The awards of a versus lineup: neutral descriptions of a habit, grouped by
 * developer in the order they were added. Null when nobody has anything to
 * name.
 */
export function awardsFor(profiles: readonly VersusProfile[]): AwardCard[] {
  return buildAwards(profiles.map((profile) => profile.metrics)).flatMap(
    (award) => {
      const owner = profiles[award.person];
      return owner ? [{ ...award, login: owner.login }] : [];
    },
  );
}

export function planAwards(
  profiles: readonly VersusProfile[],
): AwardsPlan | null {
  const awards = awardsFor(profiles);
  if (awards.length === 0) return null;
  return {
    awards,
    note: `Every award names a habit, not a score. Picked from ${AWARD_COUNT} possible awards.`,
    privateNote: privateNoteFor(profiles),
  };
}
