import { focusRing, pressable } from "@/ui/classes";
import { formatActiveSpan, type PreviewUser } from "./lookup";

/** Names longer than this leave the display face and truncate in mono. */
const DISPLAY_NAME_MAX_CHARACTERS = 18;

type PlayerCardProps = {
  user: PreviewUser;
  disabled: boolean;
  onStart: () => void;
};

/**
 * The found developer as a poster card: the avatar fills the card's width and
 * the name sits under it. Pressing it starts, like "Play".
 */
export function PlayerCard({ user, disabled, onStart }: PlayerCardProps) {
  const name = user.name ?? user.login;
  return (
    <button
      type="button"
      onClick={onStart}
      aria-disabled={disabled}
      aria-label={`Play @${user.login}`}
      className={`player-wipe flex w-full flex-col items-stretch gap-[clamp(8px,1.6dvh,16px)] border-2 border-ink p-[clamp(8px,1.4dvh,14px)] text-left not-aria-disabled:hover:bg-ink not-aria-disabled:hover:text-paper aria-disabled:cursor-wait ${pressable} ${focusRing}`}
    >
      {/* biome-ignore lint/performance/noImgElement: a remote avatar needs no optimizer */}
      <img
        src={user.avatarUrl}
        alt=""
        width={240}
        height={240}
        className="aspect-square w-full bg-paper object-cover"
      />
      <span className="block w-full min-w-0">
        <span
          className={
            name.length <= DISPLAY_NAME_MAX_CHARACTERS
              ? "block truncate font-display text-[clamp(24px,4.5dvh,48px)] font-black uppercase leading-none"
              : "block truncate font-mono text-base font-bold"
          }
        >
          {name}
        </span>
        <span className="mt-2 block truncate font-mono text-sm">
          @{user.login} · {formatActiveSpan(user.contributionYears)}
        </span>
      </span>
    </button>
  );
}
