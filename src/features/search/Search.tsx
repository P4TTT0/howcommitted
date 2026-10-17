"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { recordIntent } from "@/features/experience/intent";
import { preloadAudio, unlockAudio } from "@/playback/unlock";
import { focusRing } from "@/ui/classes";
import { StartButton } from "@/ui/StartButton";
import {
  canRetry,
  checkInput,
  formatActiveSpan,
  LOOKUP_DEBOUNCE_MS,
  type LookupState,
  lookupLogin,
  lookupMessage,
} from "./lookup";

/** Names longer than this leave the display face and truncate in mono. */
const DISPLAY_NAME_MAX_CHARACTERS = 18;

function warmUpAudio() {
  void preloadAudio().catch(() => {});
}

/**
 * Landing search: debounced exact-username lookup with a preview. Only the
 * preview is fetched here; the history waits for the click (fetch on intent),
 * which also unlocks audio before navigating to the experience.
 */
export function Search() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [state, setState] = useState<LookupState>({ kind: "idle" });
  const [attempt, setAttempt] = useState(0);
  const [starting, setStarting] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` re-runs the lookup on retry
  useEffect(() => {
    const check = checkInput(value);
    if (check.kind === "empty") {
      setState({ kind: "idle" });
      return;
    }
    if (check.kind === "invalid" || check.kind === "reserved") {
      // Stay quiet while typing; complain once the typing pauses.
      setState({ kind: "idle" });
      const timer = setTimeout(
        () =>
          setState(
            check.kind === "invalid"
              ? { kind: "invalid" }
              : { kind: "reserved", login: check.login },
          ),
        LOOKUP_DEBOUNCE_MS,
      );
      return () => clearTimeout(timer);
    }

    setState({ kind: "looking", login: check.login });
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const next = await lookupLogin(check.login, controller.signal);
      if (next && !controller.signal.aborted) setState(next);
    }, LOOKUP_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, attempt]);

  const found = state.kind === "found" ? state.user : null;

  // A found user is the likely next click: have the audio engine ready.
  useEffect(() => {
    if (found) warmUpAudio();
  }, [found]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!found || starting) return;
    setStarting(true);
    // Called before any await so the click still counts as the user gesture.
    const unlocked = await unlockAudio();
    if (unlocked) recordIntent(found.login);
    router.push(`/${found.login}`);
  }

  const displayName = found?.name ?? found?.login ?? "";

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-10">
      <h1 className="font-display text-[clamp(3.5rem,16vw,12rem)] font-black uppercase leading-[0.8]">
        Committed
      </h1>

      <form
        onSubmit={onSubmit}
        noValidate
        className="flex w-full max-w-xl flex-col gap-4"
      >
        <label htmlFor="login" className="font-mono text-xs uppercase">
          GitHub username
        </label>
        <input
          id="login"
          name="login"
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onFocus={warmUpAudio}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-describedby="lookup-status"
          className={`min-h-14 w-full border-2 border-ink bg-paper px-4 font-mono text-base ${focusRing}`}
        />

        <div
          id="lookup-status"
          role="status"
          className="min-h-20 font-mono text-xs"
        >
          {state.kind === "found" ? (
            <div className="flex items-center gap-4 border-2 border-ink p-3">
              {/* biome-ignore lint/performance/noImgElement: a 64px remote avatar needs no optimizer */}
              <img
                src={state.user.avatarUrl}
                alt=""
                width={64}
                height={64}
                className="size-16 shrink-0 border-2 border-ink object-cover"
              />
              <div className="min-w-0">
                <p
                  className={
                    displayName.length <= DISPLAY_NAME_MAX_CHARACTERS
                      ? "truncate font-display text-3xl font-black uppercase leading-none"
                      : "truncate font-mono text-sm font-bold"
                  }
                >
                  {displayName}
                </p>
                <p className="mt-1 truncate">@{state.user.login}</p>
                <p className="mt-1">
                  {formatActiveSpan(state.user.contributionYears)}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <p>{lookupMessage(state)}</p>
              {canRetry(state) && (
                <button
                  type="button"
                  onClick={() => setAttempt((count) => count + 1)}
                  className={`min-h-11 min-w-11 border-2 border-ink px-3 uppercase ${focusRing}`}
                >
                  Try again
                </button>
              )}
            </div>
          )}
        </div>

        <StartButton
          type="submit"
          size="form"
          aria-disabled={!found || starting}
        />
      </form>
    </main>
  );
}
