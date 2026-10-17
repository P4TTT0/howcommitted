import type { FinaleDefinition } from "@/features/sequencer/types";
import { EndCard } from "./EndCard";

/** The current finale: the end card. The final poster will replace it. */
export const endCardFinale: FinaleDefinition = {
  render({ login, model }, { replay }) {
    const { firstYear, lastYear } = model;
    if (firstYear === null || lastYear === null) return null;
    return (
      <EndCard
        login={login}
        total={model.plan.total}
        firstYear={firstYear}
        lastYear={lastYear}
        yearBlocks={model.yearBlocks}
        note={model.note}
        privateContributions={model.privateContributions}
        onReplay={replay}
      />
    );
  },
};
