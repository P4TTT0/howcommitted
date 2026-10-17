"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { type ClockStatus, PlaybackClock } from "@/playback/clock";
import { SoundEngine } from "@/playback/sound/engine";
import { ScreenMain } from "@/ui/ScreenMain";
import { Controls, STAGE_BOTTOM_CLASS } from "./Controls";
import { StartGate, type StartPhase } from "./StartGate";
import { buildSequence, sceneTicks, sequenceProgress } from "./sequence";
import type { FinaleDefinition, SceneData, SceneDefinition } from "./types";

export type SequencerProps = {
  data: SceneData;
  scenes: readonly SceneDefinition[];
  finale: FinaleDefinition;
  /** Shown under the start button. */
  caption: string;
  /** Visually hidden page heading. */
  title?: string;
  /** Start as soon as mounted. Only valid after a user gesture unlocked audio. */
  autoStart?: boolean;
  /** Shown in place of the start button while an auto start is loading. */
  starting?: ReactNode;
};

/**
 * Plays the scenes in order on one clock, then the finale. It owns everything
 * around the scenes: start gate, sound engine, the clock, controls, progress
 * and the transition from one scene to the next.
 */
export function Sequencer({
  data,
  scenes,
  finale,
  caption,
  title,
  autoStart = false,
  starting,
}: SequencerProps) {
  const sequence = useMemo(() => buildSequence(scenes, data), [scenes, data]);
  const durations = useMemo(
    () => sequence.map((scene) => scene.instance.duration),
    [sequence],
  );
  const ticks = useMemo(() => sceneTicks(durations), [durations]);

  const stageRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const clockRef = useRef<PlaybackClock | null>(null);
  const engineRef = useRef<SoundEngine | null>(null);
  const reducedMotionRef = useRef(false);
  const mountedRef = useRef(true);
  const autoStartedRef = useRef(false);
  const indexRef = useRef(0);

  const [phase, setPhase] = useState<StartPhase>("start");
  const [status, setStatus] = useState<ClockStatus>("idle");
  const [index, setIndexState] = useState(0);
  /** Bumped by replay so every scene remounts from its first frame. */
  const [run, setRun] = useState(0);
  const [done, setDone] = useState(false);
  const [muted, setMuted] = useState(false);
  const [failed, setFailed] = useState(false);

  const setIndex = useCallback((next: number) => {
    indexRef.current = next;
    setIndexState(next);
  }, []);

  const writeProgress = useCallback(
    (seconds: number) => {
      const fill = fillRef.current;
      if (!fill) return;
      const progress = sequenceProgress(durations, indexRef.current, seconds);
      fill.style.width = `${progress * 100}%`;
    },
    [durations],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clockRef.current?.dispose();
      clockRef.current = null;
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: begin runs once, on mount
  useEffect(() => {
    if (!autoStart || autoStartedRef.current) return;
    autoStartedRef.current = true;
    void begin();
  }, [autoStart]);

  async function begin() {
    const first = sequence[0];
    if (!first || phase !== "start") return;
    setPhase("loading");
    setFailed(false);
    const clock = new PlaybackClock({
      duration: first.instance.duration,
      bpm: first.instance.bpm,
    });
    let engine: SoundEngine | null = null;
    try {
      await clock.unlock();
      // Sound is optional: if the samples fail to load the scenes still play.
      try {
        engine = await SoundEngine.load();
        engine.setMuted(muted);
      } catch {
        engine = null;
      }
    } catch {
      clock.dispose();
      setFailed(true);
      setPhase("start");
      return;
    }
    if (!mountedRef.current) {
      clock.dispose();
      engine?.dispose();
      return;
    }
    reducedMotionRef.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    clock.onStatus((next) => {
      setStatus(next);
      if (next !== "ended") return;
      if (indexRef.current < sequence.length - 1)
        setIndex(indexRef.current + 1);
      else setDone(true);
    });
    clock.onFrame(writeProgress);
    clockRef.current = clock;
    engineRef.current = engine;
    setPhase("running");
  }

  // Mounts the current scene on the shared clock; the cleanup undoes it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scene changes are driven by index and run
  useEffect(() => {
    if (phase !== "running") return;
    const clock = clockRef.current;
    const stage = stageRef.current;
    const scene = sequence[index];
    if (!clock || !stage || !scene) return;
    clock.loadScene({
      duration: scene.instance.duration,
      bpm: scene.instance.bpm,
    });
    const cleanup = scene.instance.mount(stage, {
      clock,
      sound: () => engineRef.current,
      reducedMotion: reducedMotionRef.current,
    });
    writeProgress(0);
    clock.start();
    return cleanup;
  }, [phase, index, run, sequence]);

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    engineRef.current?.setMuted(next);
  }

  function replay() {
    setDone(false);
    setIndex(0);
    setRun((value) => value + 1);
  }

  const scene = sequence[index];
  const finished = done || sequence.length === 0;
  const clock = clockRef.current ?? undefined;
  const progressPercent = Math.round(
    sequenceProgress(durations, index, 0) * 100,
  );
  const progressText = scene
    ? `Scene ${index + 1} of ${sequence.length}: ${scene.label}`
    : "";

  return (
    <ScreenMain>
      {title && (
        <h1 className="sr-only" tabIndex={-1}>
          {title}
        </h1>
      )}
      <div className={`absolute inset-x-0 top-0 ${STAGE_BOTTOM_CLASS}`}>
        {scene && (
          <div
            key={`${run}-${scene.id}`}
            ref={stageRef}
            className="absolute inset-0"
          >
            {scene.instance.view}
          </div>
        )}
        {finished && (
          <div className="absolute inset-0 z-40 overflow-y-auto bg-paper">
            {finale.render(data, { replay })}
          </div>
        )}
      </div>

      <p className="sr-only" aria-live="polite">
        {phase === "running" && !finished ? progressText : ""}
      </p>

      {phase !== "running" && (
        <StartGate
          phase={phase}
          autoStart={autoStart}
          failed={failed}
          starting={starting}
          caption={caption}
          onBegin={begin}
        />
      )}

      <Controls
        status={finished ? "ended" : status}
        muted={muted}
        clock={clock}
        onToggleMute={toggleMute}
        ticks={ticks}
        fillRef={fillRef}
        progressText={finished ? "Finished" : progressText}
        progressPercent={finished ? 100 : progressPercent}
      />
    </ScreenMain>
  );
}
