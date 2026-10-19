import { swatchClass } from "@/features/versus/palette";
import { SceneFrame } from "@/ui/SceneFrame";
import type { Arrival } from "./plan";

const MONO = "font-mono [font-stretch:87.5%]";
/** Big screens only: wide and tall enough for the large date in each row. */
const ROOMY = "[@media(min-width:1280px)_and_(min-height:900px)]";

function Key() {
  return (
    <div className={`flex flex-wrap gap-x-6 gap-y-1.5 text-xs ${MONO}`}>
      <span className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="size-3.5 shrink-0 rounded-full border-[3px] border-ink"
        />
        Joined GitHub
      </span>
      <span className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="w-7 shrink-0 border-t-2 border-dashed border-ink"
        />
        Waiting for the first contribution
      </span>
      <span className="flex items-center gap-2.5">
        <span aria-hidden="true" className="h-3.5 w-7 shrink-0 bg-ink" />
        Contributing, up to today
      </span>
    </div>
  );
}

/**
 * Versus scene 1, the markup: one row per developer on a shared time axis. A
 * ring marks the day the account was created, a dashed line the wait for the
 * first contribution and a solid block the time since, up to today. Two plain
 * sentences sit under the chart. The static markup is the finished state;
 * `mount.ts` draws each row from left to right. Rows are stacked: at phone
 * width the name and dates sit above the line, from md up they sit beside it.
 */
export function ArrivalView({ arrival }: { arrival: Arrival }) {
  return (
    <div className="absolute inset-0">
      <SceneFrame sceneLabel="Arrival" title="How you each got here.">
        <section
          aria-label="When each developer joined GitHub and made a first contribution"
          className="absolute inset-0 flex flex-col gap-3 overflow-x-hidden overflow-y-auto md:gap-4"
        >
          <Key />

          <div className="md:grid md:grid-cols-[232px_minmax(0,1fr)] md:gap-6">
            <span aria-hidden="true" className="hidden md:block" />
            <div
              aria-hidden="true"
              className={`relative mx-2.5 h-6 border-b-2 border-ink text-[11px] md:mx-3 ${MONO}`}
            >
              {arrival.ticks.map((tick) => (
                <span
                  key={tick.label}
                  className="absolute top-0"
                  style={{ left: `${tick.at * 100}%` }}
                >
                  {tick.label}
                </span>
              ))}
            </div>
          </div>

          <ul className="flex flex-col">
            {arrival.rows.map((row) => {
              return (
                <li
                  key={row.login.toLowerCase()}
                  data-row={row.index}
                  aria-label={row.reading}
                  className="flex flex-col gap-1.5 border-b border-ink py-2 md:grid md:grid-cols-[232px_minmax(0,1fr)] md:items-center md:gap-6 md:py-2.5"
                >
                  <div className="flex min-w-0 flex-col gap-0.5 md:gap-1">
                    <p
                      className={`flex items-center gap-2 text-[13px] font-bold ${MONO}`}
                    >
                      <span
                        aria-hidden="true"
                        className={`size-3 shrink-0 rounded-full ${swatchClass(row.index)}`}
                      />
                      <span className="min-w-0 truncate">@{row.login}</span>
                    </p>
                    {row.joinedLabel && (
                      <p
                        aria-hidden="true"
                        className={`hidden font-display text-4xl font-black uppercase leading-[0.9] ${ROOMY}:block`}
                      >
                        {row.joinedLabel}
                      </p>
                    )}
                    <p className={`text-[11px] leading-snug ${MONO}`}>
                      <span className={`${ROOMY}:hidden`}>
                        {row.joinedLabel ? `Joined ${row.joinedLabel}` : ""}
                        {row.joinedLabel && row.firstLabel ? " · " : ""}
                        {row.firstLabel
                          ? `First ${row.firstLabel}`
                          : "No contributions yet"}
                      </span>
                      <span className={`hidden ${ROOMY}:block`}>
                        {row.firstLabel
                          ? `First contribution ${row.firstLabel}`
                          : "No contributions yet"}
                      </span>
                    </p>
                  </div>
                  <div
                    aria-hidden="true"
                    className="relative mx-2.5 h-6 min-w-0 md:mx-3 md:h-10"
                  >
                    {row.joinedAt !== null && row.firstAt !== null && (
                      <div
                        data-part="wait"
                        className="absolute top-1/2 origin-left border-t-2 border-dashed border-ink"
                        style={{
                          left: `${row.joinedAt * 100}%`,
                          width: `${(row.firstAt - row.joinedAt) * 100}%`,
                        }}
                      />
                    )}
                    {row.firstAt !== null && (
                      <div
                        data-part="bar"
                        className={`absolute inset-y-1 right-0 origin-left md:inset-y-2 ${swatchClass(row.index)}`}
                        style={{ left: `${row.firstAt * 100}%` }}
                      />
                    )}
                    {row.joinedAt !== null && (
                      <div
                        data-part="ring"
                        className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-ink bg-paper md:size-5"
                        style={{ left: `${row.joinedAt * 100}%` }}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          {arrival.sentences.length > 0 && (
            <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2 md:gap-4">
              {arrival.sentences.map((sentence, index) => (
                <p
                  key={sentence}
                  data-sentence={index}
                  className={`px-[18px] py-3.5 [overflow-wrap:anywhere] font-display text-[22px] font-extrabold uppercase leading-tight md:text-2xl ${
                    index === 0 ? "bg-ink text-paper" : "border-2 border-ink"
                  }`}
                >
                  {sentence}
                </p>
              ))}
            </div>
          )}
        </section>
      </SceneFrame>
    </div>
  );
}
