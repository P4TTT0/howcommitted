"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { History } from "@/domain/history";
import {
  failureCopy,
  type HistoryFailure,
} from "@/features/experience/historyResult";
import { consumeIntent } from "@/features/experience/intent";
import { LoadingMoment, Poster } from "@/features/experience/Poster";
import { SignInLink } from "@/features/experience/SignInLink";
import { VERSUS_FINALE, VERSUS_SCENES } from "@/features/scenes/registry";
import { planFromHistory } from "@/features/sequencer/model/historyPlan";
import { Sequencer } from "@/features/sequencer/Sequencer";
import type { SceneData } from "@/features/sequencer/types";
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
  | { name: "scene"; data: SceneData };

/**
 * Versus: loads every history on intent (the Play gate, or the landing
 * click), one after another, then plays them through the same sequencer as
 * solo, with the versus scenes and finale. It only exists outside production
 * (see isVersusEnabled).
 */
export function VersusExperience({ logins }: { logins: string[] }) {
  const router = useRouter();
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
          ? sceneFor(result.histories)
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
              {copy.signIn && <SignInLink returnTo={`/${logins.join("/")}`} />}
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

    case "scene":
      return (
        <Sequencer
          data={phase.data}
          scenes={VERSUS_SCENES}
          finale={VERSUS_FINALE}
          title={`${logins.map((login) => `@${login}`).join(" vs ")} contribution history`}
          caption="Turn sound on."
          onCancel={() => router.push("/")}
          autoStart
          starting={
            <LoadingMoment
              login={logins[0] as string}
              label="Loading sound"
              heading={false}
            />
          }
        />
      );
  }
}

/** The first developer fills the solo fields; `versus` carries all of them in order. */
function sceneFor(histories: readonly History[]): Phase {
  const entries = histories.map((history) => ({
    login: history.user.login,
    model: planFromHistory(history),
    joinedAt: history.user.createdAt,
  }));
  const [first] = entries;
  if (!first) return { name: "failed", login: "", failure: { kind: "server" } };
  return {
    name: "scene",
    data: {
      login: first.login,
      model: first.model,
      history: histories[0] ?? null,
      versus: entries,
    },
  };
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
