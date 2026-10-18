import type { FinaleDefinition } from "@/features/sequencer/types";
import { shareCardsFor } from "./cards";
import { EndCard } from "./EndCard";

/**
 * The final poster. The client cannot read server env, so next.config.ts
 * inlines the versus gate (closed in production) as NEXT_PUBLIC_VERSUS.
 */
const versusEnabled = process.env.NEXT_PUBLIC_VERSUS === "1";

export const endCardFinale: FinaleDefinition = {
  render(data, { replay }) {
    const { login, model } = data;
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
        cards={shareCardsFor(data)}
        privateContributions={model.privateContributions}
        versusEnabled={versusEnabled}
        onReplay={replay}
      />
    );
  },
};
