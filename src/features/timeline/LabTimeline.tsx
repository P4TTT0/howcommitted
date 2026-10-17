"use client";

import { useMemo } from "react";
import { generateFakeProfile } from "./fakeProfile";
import { buildPlan } from "./plan";
import { Timeline } from "./Timeline";

/** The playback lab: the scene driven by a generated profile. */
export function LabTimeline() {
  const plan = useMemo(() => buildPlan(generateFakeProfile()), []);
  return (
    <Timeline
      plan={plan}
      caption={`Lab. Generated profile, ${plan.years.length} years of commits. Turn sound on.`}
    />
  );
}
