import type { FinaleDefinition, VersusEntry } from "@/features/sequencer/types";
import { buildPoster, type PosterModel } from "./poster";
import { summarize } from "./summary";
import { VersusEndCard } from "./VersusEndCard";

// The sequencer asks for the finale on every render; the poster (and the image
// drawn from it) must stay the same object for the same lineup.
const posters = new WeakMap<readonly VersusEntry[], PosterModel>();

function posterFor(entries: readonly VersusEntry[]): PosterModel {
  const known = posters.get(entries);
  if (known) return known;
  const built = buildPoster(entries);
  posters.set(entries, built);
  return built;
}

/** The versus final poster: the sum, a block per developer with their awards, and the fixed line. */
export const versusFinale: FinaleDefinition = {
  render({ versus }, { replay }) {
    if (!versus || versus.length === 0) return null;
    return (
      <VersusEndCard
        summaries={summarize(versus)}
        poster={posterFor(versus)}
        onReplay={replay}
      />
    );
  },
};
