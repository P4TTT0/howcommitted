import { type Award, buildAwards } from "@/domain/versus-awards";
import {
  privateNoteFor,
  type VersusProfile,
} from "@/features/versus/versusProfiles";

export type AwardCard = Award & {
  login: string;
  /** The number or word shown big, without its unit. */
  big: string;
  /** " days", "%" ... or empty. */
  unit: string;
};

export type AwardsColumn = {
  login: string;
  /** Index into the versus palette. */
  slot: number;
  awards: AwardCard[];
};

export type AwardsPlan = {
  /** One column per developer, in the order they were added. */
  columns: AwardsColumn[];
  /** Award slots every column gets; short columns end in empty cards. */
  slots: number;
  /** Set when shared private contributions are part of the days. */
  privateNote: string | null;
};

const UNIT = /^(.*?)( days?| years?|%)$/;

/** Splits "104 days" into the big part and its unit. */
export function splitValue(value: string): { big: string; unit: string } {
  const match = UNIT.exec(value);
  return match
    ? { big: match[1] ?? value, unit: match[2] ?? "" }
    : { big: value, unit: "" };
}

/** Every award with its owner's login, grouped by developer in lineup order. */
export function awardsFor(profiles: readonly VersusProfile[]): AwardCard[] {
  return buildAwards(profiles.map((profile) => profile.metrics)).flatMap(
    (award) => {
      const owner = profiles[award.person];
      return owner
        ? [{ ...award, login: owner.login, ...splitValue(award.value) }]
        : [];
    },
  );
}

/**
 * The awards of a versus lineup: neutral descriptions of a habit, one column
 * per developer. Null when nobody has anything to name.
 */
export function planAwards(
  profiles: readonly VersusProfile[],
): AwardsPlan | null {
  const awards = awardsFor(profiles);
  if (awards.length === 0) return null;
  const columns = profiles.map<AwardsColumn>((profile, slot) => ({
    login: profile.login,
    slot,
    awards: awards.filter((award) => award.person === slot),
  }));
  return {
    columns,
    slots: Math.max(...columns.map((column) => column.awards.length)),
    privateNote: privateNoteFor(profiles),
  };
}
