"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { History } from "@/domain/history";
import {
  failureCopy,
  type HistoryFailure,
} from "@/features/experience/historyResult";
import { consumeIntent } from "@/features/experience/intent";
import { LoadingMoment, Poster } from "@/features/experience/Poster";
import { isAudioUnlocked, unlockAudio } from "@/playback/unlock";
import { actionClass } from "@/ui/classes";
import { ScreenMain } from "@/ui/ScreenMain";
import { StartButton } from "@/ui/StartButton";
import { loadHistories } from "./loadHistories";
import { swatchClass } from "./palette";

type Phase =
  | { name: "init" }
  | { name: "gate" }
  | { name: "loading"; login: string; position: number }
  | { name: "failed"; login: string; failure: HistoryFailure }
  | { name: "summary"; histories: History[] };

/**
 * TEMPORARY. Versus playback is not built yet, so this loads every history
 * on intent (the Play gate, or the landing click), one after another, and
 * lists each developer with their calendar total. It only exists outside
 * production (see isVersusEnabled) and is replaced by the versus scenes.
 */
export function VersusExperience({ logins }: { logins: string[] }) {
  const [phase, setPhase] = useState<Phase>({ name: "init" });
  const mountedRef = useRef(true);
  const decidedRef = useRef(false);
  const inFlightRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);

  async function begin() {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const result = await loadHistories(
        logins,
        controller.signal,
        undefined,
        (login, index) => {
          if (mountedRef.current)
            setPhase({ name: "loading", login, position: index + 1 });
        },
      );
      if (!mountedRef.current) return;
      if (result.kind === "aborted") {
        // Only a development remount gets here while mounted: back to the gate.
        setPhase({ name: "gate" });
        return;
      }
      setPhase(
        result.kind === "ok"
          ? { name: "summary", histories: result.histories }
          : { name: "failed", login: result.login, failure: result.failure },
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
      if (consumeIntent(logins.join("/")) && isAudioUnlocked()) void begin();
      else setPhase({ name: "gate" });
    }
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  function start() {
    void unlockAudio();
    void begin();
  }

  switch (phase.name) {
    case "init":
      return (
        <ScreenMain>
          <Poster login={logins[0] as string}>{null}</Poster>
        </ScreenMain>
      );

    case "gate":
      return (
        <ScreenMain className="overflow-auto">
          <Lineup logins={logins} />
          <div className="flex flex-col gap-4 p-4">
            <StartButton tone="ink" onClick={start} />
            <p className="font-mono text-xs">
              Turn sound on. {logins.length} histories load, one after another,
              when you press start.
            </p>
          </div>
        </ScreenMain>
      );

    case "loading":
      return (
        <ScreenMain>
          <LoadingMoment
            login={phase.login}
            label={`Reading the contribution history, ${phase.position} of ${logins.length}`}
          />
        </ScreenMain>
      );

    case "failed": {
      const copy = failureCopy(phase.failure, phase.login);
      return (
        <ScreenMain>
          <Poster login={phase.login} tone="ink">
            <p role="status" className="font-mono text-sm">
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
        </ScreenMain>
      );
    }

    case "summary":
      return (
        <ScreenMain className="overflow-auto">
          <Lineup logins={logins} />
          <ul className="flex flex-col gap-3 p-4 pt-0">
            {phase.histories.map((history, index) => (
              <li
                key={history.user.login}
                className="flex items-center gap-3 border-2 border-ink p-3"
              >
                <span
                  aria-hidden="true"
                  className={`size-6 shrink-0 ${swatchClass(index)}`}
                />
                <span className="min-w-0 flex-1 truncate font-mono text-sm font-bold">
                  @{history.user.login}
                </span>
                <span className="text-right font-mono text-xs">
                  <span className="block font-display text-4xl font-black leading-none">
                    {history.totalContributions.toLocaleString("en-US")}
                  </span>
                  calendar contributions
                </span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-3 p-4 pt-0">
            <p className="font-mono text-xs">
              Temporary summary. The versus scenes are not built yet.
            </p>
            <Link href="/" className={actionClass}>
              Search again
            </Link>
          </div>
        </ScreenMain>
      );
  }
}

/** The lineup as the title, each developer in their versus color. */
function Lineup({ logins }: { logins: string[] }) {
  return (
    <header className="p-4">
      <h1 className="font-display text-[clamp(40px,9vw,96px)] font-black uppercase leading-[0.9]">
        Versus
      </h1>
      <ul className="mt-3 flex flex-wrap gap-2 font-mono text-sm">
        {logins.map((login, index) => (
          <li
            key={login.toLowerCase()}
            className="flex min-h-9 items-center gap-2 border-2 border-ink pr-2 pl-2"
          >
            <span
              aria-hidden="true"
              className={`size-3 shrink-0 ${swatchClass(index)}`}
            />
            @{login}
          </li>
        ))}
      </ul>
    </header>
  );
}
