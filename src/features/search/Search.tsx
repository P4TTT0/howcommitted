"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { recordIntent } from "@/features/experience/intent";
import { preloadAudio, unlockAudio } from "@/playback/unlock";
import { actionClass } from "@/ui/classes";
import { StartButton } from "@/ui/StartButton";
import {
  canRetry,
  checkInput,
  LOOKUP_DEBOUNCE_MS,
  type LookupState,
  lookupLogin,
  lookupMessage,
} from "./lookup";
import { PreviewRow } from "./PreviewRow";
import { useTypingPlaceholder } from "./useTypingPlaceholder";

const NUDGE = "Type a GitHub username first.";

function warmUpAudio() {
  void preloadAudio().catch(() => {});
}

/**
 * The landing question: "How committed is @[input]?". Debounced exact-username lookup with a preview. debounced exact-username lookup with a preview. Only the
 * preview is fetched here; the history waits for the click (fetch on intent),
 * which also unlocks audio before navigating to the experience.
 */
export function Search() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [state, setState] = useState<LookupState>({ kind: "idle" });
  const [attempt, setAttempt] = useState(0);
  const [starting, setStarting] = useState(false);
  const [focused, setFocused] = useState(false);
  const [nudge, setNudge] = useState(false);
  const placeholder = useTypingPlaceholder(value === "" && !focused);

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

  async function start() {
    if (!found || starting) return;
    setStarting(true);
    // Called before any await so the click still counts as the user gesture.
    const unlocked = await unlockAudio();
    if (unlocked) recordIntent(found.login);
    router.push(`/${found.login}`);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    // Not found yet: say so politely instead of doing nothing silently.
    if (!found && state.kind === "idle") setNudge(true);
    void start();
  }

  const statusText =
    nudge && state.kind === "idle"
      ? NUDGE
      : lookupMessage(state as Exclude<LookupState, { kind: "found" }>);
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-7">
      <div className="font-display text-[clamp(40px,12vw,200px)] font-black uppercase leading-[0.86]">
        <label id="ask-how" htmlFor="login" className="block whitespace-nowrap">
          How committed
        </label>
        <span id="ask-rest" className="sr-only">
          is GitHub username
        </span>
        <span className="flex max-w-full items-baseline gap-[0.2em]">
          <span aria-hidden="true">is&nbsp;@</span>
          <span className="inline-grid min-w-0 max-w-full grid-cols-[minmax(0,1fr)] items-baseline">
            {/* Sizer: the field is as wide as what it shows, like part of the sentence. */}
            <span
              aria-hidden="true"
              className="invisible col-start-1 row-start-1 whitespace-pre pr-[0.05em]"
            >
              {value || placeholder || "m"}
            </span>
            <input
              id="login"
              name="login"
              type="text"
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                setNudge(false);
              }}
              onFocus={() => {
                setFocused(true);
                warmUpAudio();
              }}
              onBlur={() => setFocused(false)}
              placeholder={placeholder}
              aria-labelledby="ask-how ask-rest"
              aria-describedby="lookup-status"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="col-start-1 row-start-1 w-0 min-w-full rounded-none border-0 border-b-[0.07em] border-ink bg-transparent p-0 font-[inherit] uppercase text-[inherit] caret-block-ultramarine outline-none placeholder:text-ink placeholder:opacity-40 focus:border-block-ultramarine"
            />
          </span>
          <span aria-hidden="true">?</span>
        </span>
      </div>

      <div
        id="lookup-status"
        role="status"
        className="min-h-14 font-mono text-sm"
      >
        {state.kind === "found" ? (
          <PreviewRow user={state.user} disabled={starting} onStart={start} />
        ) : (
          <div className="flex min-h-14 flex-wrap items-center gap-3">
            <p>{statusText}</p>
            {canRetry(state) && (
              <button
                type="button"
                onClick={() => setAttempt((count) => count + 1)}
                className={`${actionClass} min-h-11`}
              >
                Try again
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
        <StartButton
          type="submit"
          tone="ink"
          size="cta"
          aria-disabled={!found || starting}
        >
          Listen
        </StartButton>
        <p className="max-w-[48ch] font-mono text-[15px] leading-relaxed">
          Type a GitHub username. Their contribution history plays as sound and
          motion, year by year. Headphones on.
        </p>
      </div>
    </form>
  );
}
