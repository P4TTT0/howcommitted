import { focusRing } from "@/ui/classes";
import { formatShare, type LanguageBlock, languageReading } from "./blocks";

type LanguageMosaicViewProps = { blocks: readonly LanguageBlock[] };

/**
 * Scene 4, the markup: a readout block (the language being drawn, in its
 * color) above one column per language. Width is the share of bytes, color is
 * the rank. The static markup is the finished state; `mount.ts` replays it.
 */
export function LanguageMosaicView({ blocks }: LanguageMosaicViewProps) {
  const last = blocks.at(-1);
  const summary = blocks.map(languageReading).join("; ");

  return (
    <div className="absolute inset-0 flex flex-col">
      <section
        data-role="readout"
        aria-hidden="true"
        className="flex h-[30dvh] shrink-0 flex-col justify-between p-4 landscape:flex-row landscape:items-end"
        style={{
          backgroundColor: last?.background,
          color: last?.foreground,
        }}
      >
        <p
          data-role="name"
          className="min-w-0 break-words font-display text-[min(16vw,10dvh)] font-black leading-[0.85] landscape:text-[min(9vw,22dvh)]"
        >
          {last?.name}
        </p>
        <p
          data-role="value"
          className="font-display text-[min(20vw,11dvh)] font-black leading-[0.8] tabular-nums landscape:text-[min(10vw,20dvh)]"
        >
          {last ? formatShare(last.share) : ""}
        </p>
      </section>

      <div className="flex min-h-0 flex-1 flex-col px-4 pb-2 pt-4">
        <p className="font-mono text-xs uppercase">
          Languages of owned repos, by bytes. Not per commit.
        </p>
        <div className="relative mt-3 min-h-0 flex-1">
          <div
            role="img"
            aria-label={`Languages of owned repos, by bytes, not per commit: ${summary}`}
            className="flex h-full items-end gap-1 border-b-2 border-ink"
          >
            {blocks.map((block, index) => (
              <div
                key={block.name}
                data-block={index}
                className="h-full min-w-1"
                style={{
                  flex: `${block.share} 1 0%`,
                  backgroundColor: block.background,
                  transformOrigin: "50% 100%",
                }}
              />
            ))}
          </div>
          {/* Explore only: `mount.ts` shows it once the scene has ended. */}
          <div
            data-role="scrub"
            hidden
            role="slider"
            tabIndex={-1}
            aria-label="Languages of owned repos"
            aria-orientation="horizontal"
            aria-valuemin={0}
            aria-valuemax={Math.max(0, blocks.length - 1)}
            aria-valuenow={Math.max(0, blocks.length - 1)}
            aria-valuetext={last ? languageReading(last) : ""}
            className={`absolute inset-0 touch-none ${focusRing}`}
          />
        </div>
        <ul
          aria-hidden="true"
          className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs"
        >
          {blocks.map((block) => (
            <li key={block.name} className="flex items-center gap-1.5">
              <span
                className="inline-block size-3 border border-ink"
                style={{ backgroundColor: block.background }}
              />
              {block.name} {formatShare(block.share)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
