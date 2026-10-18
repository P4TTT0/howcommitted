import { BPM, TOTAL_SECONDS } from "@/features/sequencer/model/plan";
import type { SceneDefinition } from "@/features/sequencer/types";
import { exploreTimeline } from "./explore";
import { mountTimeline } from "./mount";
import { flagMarks } from "./scrub";
import { TimelineView } from "./TimelineView";
import { planYearSlots } from "./years";

/**
 * Scene 1: yearly blocks under the running total line, repo-creation flags and
 * the big counter. Block height is the calendar total of the year, the line is
 * the cumulative total, and the year in progress is dashed.
 */
export const timelineScene: SceneDefinition = {
  id: "timeline",
  label: "Timeline",
  create({ login, model }) {
    const { plan, note } = model;
    if (plan.total === 0 || plan.days.length === 0) return null;
    const slots = planYearSlots(plan, new Date().getUTCFullYear());
    if (slots.length === 0) return null;
    const marks = flagMarks(model.repoFlags, plan.days);
    return {
      duration: TOTAL_SECONDS,
      bpm: BPM,
      view: (
        <TimelineView
          login={login}
          plan={plan}
          slots={slots}
          note={note}
          marks={marks}
        />
      ),
      mount: (root, runtime) => mountTimeline(root, plan, slots, runtime),
      explore: (root) => exploreTimeline(root, plan, slots),
    };
  },
};
