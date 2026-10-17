"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  type HistoryPlan,
  planFromHistory,
} from "@/features/timeline/historyPlan";
import { Timeline } from "@/features/timeline/Timeline";
import { isAudioUnlocked, unlockAudio } from "@/playback/unlock";
import { EndCard } from "./EndCard";
import {
  failureCopy,
  type HistoryFailure,
  type HistoryOutcome,
  interpretHistory,
} from "./historyResult";
import { actionClass, LoadingMoment, Poster } from "./Poster";

type Phase =
  | { name: "init" }
  | { name: "gate" }
  | { name: "loading" }
  | { name: "failed"; failure: HistoryFailure }
  | { name: "empty"; login: string }
  | { name: "scene"; login: string; model: HistoryPlan };

async function fetchHistory(login: string): Promise<HistoryOutcome> {
  try {
    const response = await fetch(`/api/history/${encodeURIComponent(login)}`);
    const body: unknown = await response.json().catch(() => null);
    return interpretHistory(response.status, body);
  } catch {
    return { kind: "server" };
  }
}

/**
 * The solo experience for one login. The history is fetched on intent, never
 * before: right after the landing click (audio already unlocked), or after
 * the start button on a direct visit. Anonymous cold runs are scarce, so
 * merely opening a link must not spend one.
 */
export function Experience({ login }: { login: string }) {
  const [phase, setPhase] = useState<Phase>({ name: "init" });
  const mountedRef = useRef(true);
  const autoStartedRef = useRef(false);

  async function begin() {
    setPhase({ name: "loading" });
    const outcome = await fetchHistory(login);
    if (!mountedRef.current) return;
    if (outcome.kind !== "ok") {
      setPhase({ name: "failed", failure: outcome });
      return;
    }
    const model = planFromHistory(outcome.history);
    const shown = outcome.history.user.login;
    setPhase(
      model.plan.total === 0
        ? { name: "empty", login: shown }
        : { name: "scene", login: shown, model },
    );
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: decide once, on mount
  useEffect(() => {
    mountedRef.current = true;
    if (!autoStartedRef.current) {
      autoStartedRef.current = true;
      // Arrived from the landing click: audio is already unlocked, so go.
      // A shared link or reload is locked and waits for its own click.
      if (isAudioUnlocked()) void begin();
      else setPhase({ name: "gate" });
    }
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /** Click handler: unlocks audio synchronously, then fetches. */
  function start() {
    void unlockAudio();
    void begin();
  }

  switch (phase.name) {
    case "init":
      return (
        <main className="relative h-dvh w-full">
          <Poster login={login}>
            <span className="sr-only" role="status">
              Getting ready
            </span>
          </Poster>
        </main>
      );

    case "gate":
      return (
        <main className="relative h-dvh w-full">
          <Poster login={login}>
            <button
              type="button"
              onClick={start}
              className="bg-ink px-[0.4em] py-[0.25em] text-center font-display text-[min(13vw,14dvh)] font-black uppercase leading-[0.85] text-paper focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-ink"
            >
              How Committed?
            </button>
            <p className="font-mono text-xs">
              Turn sound on. The history loads when you press start.
            </p>
          </Poster>
        </main>
      );

    case "loading":
      return (
        <main className="relative h-dvh w-full">
          <LoadingMoment
            login={login}
            label="Reading the public commit history"
          />
        </main>
      );

    case "failed": {
      const copy = failureCopy(phase.failure, login);
      return (
        <main className="relative h-dvh w-full">
          <Poster login={login} tone="ink">
            <p role="alert" className="font-mono text-sm">
              {copy.message}
            </p>
            <div className="flex flex-wrap gap-2">
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
        </main>
      );
    }

    case "empty":
      return (
        <main className="relative h-dvh w-full">
          <Poster login={phase.login} tone="ink">
            <p role="status" className="font-mono text-sm">
              No public commits found for @{phase.login}. Nothing to play yet.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href="/" className={actionClass}>
                Search again
              </Link>
            </div>
          </Poster>
        </main>
      );

    case "scene": {
      const { model } = phase;
      return (
        <Timeline
          plan={model.plan}
          title={`@${phase.login} commit history`}
          caption="Turn sound on."
          autoStart
          starting={
            <LoadingMoment
              login={phase.login}
              label="Loading sound"
              heading={false}
            />
          }
          note={model.note}
          renderEnd={({ replay }) => (
            <EndCard
              login={phase.login}
              total={model.plan.total}
              firstYear={model.firstYear}
              lastYear={model.lastYear}
              yearBlocks={model.yearBlocks}
              note={model.note}
              onReplay={replay}
            />
          )}
        />
      );
    }
  }
}
