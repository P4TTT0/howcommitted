import { focusRing, pressable } from "@/ui/classes";
import { formatActiveSpan, type PreviewUser } from "./lookup";

type PreviewRowProps = {
  user: PreviewUser;
  disabled: boolean;
  onStart: () => void;
};

/** The found user as one compact row; pressing it starts, like "Listen". */
export function PreviewRow({ user, disabled, onStart }: PreviewRowProps) {
  return (
    <button
      type="button"
      onClick={onStart}
      aria-disabled={disabled}
      className={`flex min-h-14 w-full max-w-md items-center gap-3 border-2 border-ink px-3 py-2 text-left font-mono text-sm not-aria-disabled:hover:bg-ink not-aria-disabled:hover:text-paper aria-disabled:cursor-wait ${pressable} ${focusRing}`}
    >
      {/* biome-ignore lint/performance/noImgElement: a 40px remote avatar needs no optimizer */}
      <img
        src={user.avatarUrl}
        alt=""
        width={40}
        height={40}
        className="size-10 shrink-0 bg-paper object-cover"
      />
      <span className="min-w-0">
        <span className="block truncate font-bold">
          {user.name ?? user.login}
        </span>
        <span className="block truncate">
          @{user.login} · {formatActiveSpan(user.contributionYears)}
        </span>
      </span>
    </button>
  );
}
