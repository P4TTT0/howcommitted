"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { unlockAudio } from "@/playback/unlock";
import {
  canRetry,
  checkInput,
  formatActiveSpan,
  interpretLookup,
  LOOKUP_DEBOUNCE_MS,
  type LookupState,
  lookupMessage,
} from "./lookup";

const focusClass =
  "focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-ink";

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
    if (check.kind === "invalid") {
      // Stay quiet while typing; complain once the typing pauses.
      setState({ kind: "idle" });
      const timer = setTimeout(
        () => setState({ kind: "invalid" }),
        LOOKUP_DEBOUNCE_MS,
      );
      return () => clearTimeout(timer);
    }

    setState({ kind: "looking", login: check.login });
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/user/${encodeURIComponent(check.login)}`,
          { signal: controller.signal },
        );
        const body: unknown = await response.json().catch(() => null);
        setState(interpretLookup(check.login, response.status, body));
      } catch {
        if (!controller.signal.aborted) setState({ kind: "failed" });
      }
    }, LOOKUP_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, attempt]);

  const found = state.kind === "found" ? state.user : null;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!found || starting) return;
    setStarting(true);
    // Called before any await so the click still counts as the user gesture.
    await unlockAudio();
    router.push(`/${found.login}`);
  }

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
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-describedby="lookup-status"
          className={`min-h-14 w-full border-2 border-ink bg-paper px-4 font-mono text-base ${focusClass}`}
        />

        <div
          id="lookup-status"
          role="status"
          className="min-h-20 font-mono text-xs"
        >
          {found ? (
            <div className="flex items-center gap-4 border-2 border-ink p-3">
              {/* biome-ignore lint/performance/noImgElement: a 64px remote avatar needs no optimizer */}
              <img
                src={found.avatarUrl}
                alt=""
                width={64}
                height={64}
                className="size-16 shrink-0 border-2 border-ink object-cover"
              />
              <div className="min-w-0">
                <p className="truncate font-display text-3xl font-black uppercase leading-none">
                  {found.name ?? found.login}
                </p>
                <p className="mt-1 truncate">@{found.login}</p>
                <p className="mt-1">
                  {formatActiveSpan(found.contributionYears)}
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
                  className={`min-h-11 min-w-11 border-2 border-ink px-3 uppercase ${focusClass}`}
                >
                  Try again
                </button>
              )}
            </div>
          )}
        </div>

        <button
          type="submit"
          aria-disabled={!found || starting}
          className={`min-h-14 bg-block-ultramarine px-6 py-3 text-center font-display text-[clamp(2.5rem,9vw,4.5rem)] font-black uppercase leading-[0.85] text-paper aria-disabled:cursor-not-allowed aria-disabled:opacity-40 ${focusClass}`}
        >
          How Committed?
        </button>
      </form>
    </main>
  );
}
