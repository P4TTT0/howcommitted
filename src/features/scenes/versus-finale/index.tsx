import type { FinaleDefinition } from "@/features/sequencer/types";
import { summarize } from "./summary";
import { VersusEndCard } from "./VersusEndCard";

/** The versus final poster: a side-by-side summary and the fixed line. */
export const versusFinale: FinaleDefinition = {
  render({ versus }, { replay }) {
    if (!versus || versus.length === 0) return null;
    return <VersusEndCard summaries={summarize(versus)} onReplay={replay} />;
  },
};
