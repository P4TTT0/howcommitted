"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FINALE, SCENES } from "@/features/scenes/registry";
import { recordPrefill } from "@/features/search/prefill";
import { planFromHistory } from "@/features/sequencer/model/historyPlan";
import { Sequencer } from "@/features/sequencer/Sequencer";
import { shortcutFor } from "@/features/sequencer/shortcuts";
import type { SceneData } from "@/features/sequencer/types";
import { fetchHistory } from "@/features/versus/loadHistories";
import { isAudioUnlocked, unlockAudio } from "@/playback/unlock";
import { actionClass } from "@/ui/classes";
import { ScreenMain } from "@/ui/ScreenMain";
import { StartButton } from "@/ui/StartButton";
import {
  failureCopy,
  type HistoryFailure,
  type HistoryOutcome,
} from "./historyResult";
import { consumeIntent } from "./intent";
import { LoadingScreen } from "./LoadingScreen";
import { LoadingMoment, Poster } from "./Poster";
import { SignInLink } from "./SignInLink";

type Phase =
  | { name: "init" }
  | { name: "gate" }
  | { name: "loading" }
  | { name: "failed"; failure: HistoryFailure }
  | { name: "empty"; login: string }
  | { name: "scene"; login: string; data: SceneData };

/** Maps a fetched history to the next screen; a bad payload degrades, never throws. */
function sceneOrEmpty(outcome: HistoryOutcome & { kind: "ok" }): Phase {
  try {
    const model = planFromHistory(outcome.history);
    const login = outcome.history.user.login;
    if (
      model.plan.total === 0 ||
      model.firstYear === null ||
      model.lastYear === null
    ) {
      return { name: "empty", login };
    }
    return {
      name: "scene",
      login,
      data: { login, model, history: outcome.history },
    };
  } catch {
    return { name: "failed", failure: { kind: "server" } };
  }
}

/** The one polite announcement for each screen, spoken from a persistent region. */
function announcement(phase: Phase, login: string): string {
  switch (phase.name) {
    case "init":
      return "";
    case "gate":
      return "Press Play to start.";
    case "loading":
      return "Reading the contribution history.";
    case "failed":
      return failureCopy(phase.failure, login).message;
    case "empty":
      return `No contributions found for @${phase.login}. Nothing to play yet.`;
    case "scene":
      return `Starting @${phase.login}.`;
  }
}

/**
 * The solo experience for one login. The history is fetched on intent, never
 * before: right after the landing click (which recorded a one-shot intent), or
 * after the start button on any other arrival (shared link, reload, back or
 * forward). Anonymous cold runs are scarce, so merely opening a link must not
 * spend one.
 */
export function Experience({ login }: { login: string }) {
  const [phase, setPhase] = useState<Phase>({ name: "init" });
  const rootRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const decidedRef = useRef(false);
  const inFlightRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const router = useRouter();

  async function begin() {
    // One request at a time: a double click or a retry mid-flight is a no-op.
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    const request = new AbortController();
    abortRef.current = request;
    setPhase({ name: "loading" });
    try {
      const outcome = await fetchHistory(login, request.signal);
      if (!mountedRef.current || request.signal.aborted) return;
      setPhase(
        outcome.kind === "ok"
          ? sceneOrEmpty(outcome)
          : { name: "failed", failure: outcome },
      );
    } finally {
      inFlightRef.current = false;
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: decide once, on mount
  useEffect(() => {
    mountedRef.current = true;
    if (!decidedRef.current) {
      decidedRef.current = true;
      // Only the landing click starts on its own, and only with audio unlocked.
      // Everything else waits for its own click.
      if (consumeIntent(login) && isAudioUnlocked()) void begin();
      else setPhase({ name: "gate" });
    }
    return () => {
      mountedRef.current = false;
      // Leaving mid-request must not keep a cold run going for nobody.
      abortRef.current?.abort();
    };
  }, []);

  /**
   * Cancel and go back: abort an in-flight request and return to the landing
   * with this login in the search. Always a plain navigation to "/", so it also
   * works on a shared-link visit with nothing to go back to.
   */
  function cancel() {
    abortRef.current?.abort();
    inFlightRef.current = false;
    recordPrefill(login);
    router.push("/");
  }

  const cancelRef = useRef(cancel);
  cancelRef.current = cancel;
  const loading = phase.name === "loading";
  useEffect(() => {
    if (!loading) return;
    function onKeyDown(event: KeyboardEvent) {
      if (shortcutFor(event) !== "cancel") return;
      event.preventDefault();
      cancelRef.current();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [loading]);

  // Each screen change moves focus to its heading so assistive tech follows.
  useEffect(() => {
    if (phase.name === "init") return;
    rootRef.current?.querySelector<HTMLElement>("h1")?.focus();
  }, [phase.name]);

  /** Click handler: unlocks audio synchronously, then fetches. */
  function start() {
    void unlockAudio();
    void begin();
  }

  return (
    <div ref={rootRef}>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement(phase, login)}
      </p>
      {screen(phase, login, start, cancel)}
    </div>
  );
}

function screen(
  phase: Phase,
  login: string,
  start: () => void,
  cancel: () => void,
) {
  switch (phase.name) {
    case "init":
      return (
        <ScreenMain>
          <Poster login={login}>{null}</Poster>
        </ScreenMain>
      );

    case "gate":
      return (
        <ScreenMain>
          <Poster login={login}>
            <StartButton tone="ink" onClick={start} />
            <p className="font-mono text-xs">
              Turn sound on. The history loads when you press start.
            </p>
          </Poster>
        </ScreenMain>
      );

    case "loading":
      return (
        <ScreenMain>
          <LoadingScreen logins={[login]} onCancel={cancel} />
        </ScreenMain>
      );

    case "failed": {
      const copy = failureCopy(phase.failure, login);
      return (
        <ScreenMain>
          <Poster login={login} tone="ink">
            <p className="font-mono text-sm">{copy.message}</p>
            <div className="flex flex-wrap gap-2">
              {copy.signIn && <SignInLink returnTo={`/${login}`} />}
              {copy.retry && (
                <button
                  type="button"
                  onClick={start}
                  className={`${actionClass} bg-ink text-paper`}
                >
                  Try again
                </button>
              )}
              <Link href="/" className={actionClass}>
                Search again
              </Link>
            </div>
          </Poster>
        </ScreenMain>
      );
    }

    case "empty":
      return (
        <ScreenMain>
          <Poster login={phase.login} tone="ink">
            <p className="font-mono text-sm">
              No contributions found for @{phase.login}. Nothing to play yet.
            </p>
            <p className="font-mono text-xs">
              Private contributions only appear if @{phase.login} shares them on
              their GitHub profile.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href="/" className={actionClass}>
                Search again
              </Link>
            </div>
          </Poster>
        </ScreenMain>
      );

    case "scene":
      return (
        <Sequencer
          data={phase.data}
          scenes={SCENES}
          finale={FINALE}
          title={`@${phase.login} contribution history`}
          caption="Turn sound on."
          onCancel={cancel}
          autoStart
          starting={
            <LoadingMoment
              login={phase.login}
              label="Loading sound"
              heading={false}
            />
          }
        />
      );
  }
}
