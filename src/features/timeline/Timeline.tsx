"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ClockStatus } from "@/playback/clock";
import { CHART_HEIGHT, CHART_WIDTH, linePath } from "./chart";
import { generateFakeProfile } from "./fakeProfile";
import { blockForYearIndex, buildPlan, DRAW_SECONDS } from "./plan";
import { createScene, formatCount, type Scene, yearIndexAt } from "./scene";

type Phase = "start" | "loading" | "running";

const controlClass =
  "min-h-11 min-w-11 border-2 border-ink px-3 py-2 font-mono text-xs uppercase focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40 aria-pressed:bg-ink aria-pressed:text-paper";

export function Timeline() {
  const plan = useMemo(() => buildPlan(generateFakeProfile()), []);
  const path = useMemo(() => linePath(plan), [plan]);
  const rootRef = useRef<HTMLElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const mountedRef = useRef(true);
  const [phase, setPhase] = useState<Phase>("start");
  const [status, setStatus] = useState<ClockStatus>("idle");
  const [muted, setMuted] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  async function begin() {
    const root = rootRef.current;
    if (!root || phase !== "start") return;
    setPhase("loading");
    setFailed(false);
    try {
      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const scene = await createScene({ root, plan, muted, reducedMotion });
      if (!mountedRef.current) {
        scene.dispose();
        return;
      }
      sceneRef.current = scene;
      scene.clock.onStatus(setStatus);
      scene.clock.start();
      setPhase("running");
    } catch {
      // createScene already tore down anything it had built.
      setFailed(true);
      setPhase("start");
    }
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    sceneRef.current?.setMuted(next);
  }

  const clock = sceneRef.current?.clock;
  const first = blockForYearIndex(0);
  const firstYear = plan.years[0]?.year ?? 0;
  const lastYear = plan.years.at(-1)?.year ?? firstYear;
  const chartLabel = `Cumulative commits from ${firstYear} to ${lastYear}, ${formatCount(plan.total)} in total`;

  return (
    <main
      ref={rootRef}
      className="relative h-dvh w-full overflow-hidden bg-paper text-ink"
    >
      <div data-role="shake" className="absolute inset-0">
        <section
          data-role="block"
          className="absolute inset-x-0 top-0 flex h-[42dvh] flex-col justify-between overflow-hidden p-4 landscape:flex-row landscape:items-end"
          style={{
            backgroundColor: first.background,
            color: first.foreground,
          }}
        >
          <p
            data-role="year"
            className="font-display text-[min(26vw,15dvh)] font-black leading-[0.8] landscape:text-[min(15vw,34dvh)]"
          >
            {firstYear}
          </p>
          <div className="landscape:text-right">
            <p
              data-role="total"
              className="font-display text-[min(26vw,15dvh)] font-black leading-[0.8] tabular-nums landscape:text-[min(15vw,34dvh)]"
            >
              0
            </p>
            <p className="mt-4 font-mono text-xs uppercase">Commits</p>
          </div>
        </section>

        <div className="absolute inset-x-0 bottom-14 top-[42dvh] flex flex-col px-4 pb-2 pt-6">
          <div className="relative min-h-0 flex-1">
            <svg
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full"
              role="img"
              aria-label={chartLabel}
            >
              <defs>
                <clipPath id="reveal">
                  <rect
                    data-role="clip"
                    x="0"
                    y="0"
                    width="0"
                    height={CHART_HEIGHT}
                  />
                </clipPath>
              </defs>
              <path
                d={path}
                clipPath="url(#reveal)"
                fill="none"
                stroke="currentColor"
                strokeWidth="5"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <span
              data-role="head"
              className="absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink"
              style={{ left: "0%", top: "100%" }}
            />
            {plan.years.map((span) => (
              <div
                key={span.year}
                className="absolute inset-y-0 w-px bg-ink/15"
                style={{ left: `${span.startProgress * 100}%` }}
              />
            ))}
          </div>
          <div className="relative h-5 font-mono text-[10px]">
            {plan.years.map((span) => (
              <span
                key={span.year}
                className="absolute top-1"
                style={{ left: `${span.startProgress * 100}%` }}
              >
                {span.year}
              </span>
            ))}
          </div>
        </div>
      </div>

      {plan.milestones.map((milestone, index) => {
        const colors = blockForYearIndex(
          yearIndexAt(plan, milestone.time / DRAW_SECONDS),
        );
        return (
          <div
            key={milestone.time}
            data-flood={index}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center"
            style={{
              backgroundColor: colors.background,
              color: colors.foreground,
              transform: "scaleY(0)",
              transformOrigin: "50% 100%",
            }}
          >
            <span className="font-display text-[min(34vw,36dvh)] font-black leading-[0.8] tabular-nums">
              {formatCount(milestone.value)}
            </span>
            <span className="mt-4 font-mono text-sm uppercase">Commits</span>
          </div>
        );
      })}

      <p className="sr-only" aria-live="polite">
        {status === "ended"
          ? `Finished. ${formatCount(plan.total)} commits.`
          : ""}
      </p>

      {phase !== "running" && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 bg-paper p-4 pb-20">
          <button
            type="button"
            onClick={begin}
            disabled={phase === "loading"}
            className="bg-block-ultramarine px-[0.4em] py-[0.25em] text-center font-display text-[min(18vw,24dvh)] font-black uppercase leading-[0.85] text-paper focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-ink"
          >
            How Committed?
          </button>
          <p className="max-w-prose text-center font-mono text-xs">
            {phase === "loading"
              ? "Loading sound"
              : `Lab. Generated profile, ${plan.years.length} years of commits. Turn sound on.`}
          </p>
          {failed && (
            <p role="alert" className="font-mono text-xs">
              Playback could not start. Try again.
            </p>
          )}
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 z-50 flex h-14 items-center gap-2 border-t-2 border-ink bg-paper px-4">
        <button
          type="button"
          className={controlClass}
          disabled={status !== "playing" && status !== "paused"}
          onClick={() =>
            status === "playing" ? clock?.pause() : clock?.resume()
          }
        >
          {status === "paused" ? "Resume" : "Pause"}
        </button>
        <button
          type="button"
          className={controlClass}
          disabled={status !== "playing" && status !== "paused"}
          onClick={() => clock?.skip()}
        >
          Skip
        </button>
        <button
          type="button"
          className={controlClass}
          disabled={status === "idle"}
          onClick={() => clock?.restart()}
        >
          Replay
        </button>
        <button
          type="button"
          className={`${controlClass} ml-auto`}
          aria-pressed={muted}
          onClick={toggleMute}
        >
          Mute
        </button>
      </div>
    </main>
  );
}
