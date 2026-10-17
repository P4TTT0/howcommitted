"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { type ClockStatus, PlaybackClock } from "@/playback/clock";
import { SoundEngine } from "@/playback/sound/engine";
import { ScreenMain } from "@/ui/ScreenMain";
import { Controls, STAGE_BOTTOM_CLASS } from "./Controls";
import { SequenceController, type SequenceState } from "./controller";
import { formatCount } from "./model/format";
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

const INITIAL: SequenceState = { index: 0, run: 0, done: false };

/**
 * Plays the scenes in order on one clock, then the finale. It owns everything
 * around the scenes: start gate, sound engine, the clock, controls, progress
 * and the transition from one scene to the next (see `SequenceController`).
 * With no playable scene it shows the finale at once.
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
  const controllerRef = useRef<SequenceController | null>(null);
  const mountedRef = useRef(true);
  const autoStartedRef = useRef(false);

  const [phase, setPhase] = useState<StartPhase>("start");
  const [status, setStatus] = useState<ClockStatus>("idle");
  const [seq, setSeq] = useState<SequenceState>(INITIAL);
  const [muted, setMuted] = useState(false);
  const [failed, setFailed] = useState(false);

  const paintProgress = useCallback(
    (index: number, seconds: number) => {
      const fill = fillRef.current;
      if (!fill) return;
      fill.style.width = `${sequenceProgress(durations, index, seconds) * 100}%`;
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
      controllerRef.current = null;
    };
  }, []);

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
    const controller = new SequenceController(
      sequence,
      clock,
      {
        sound: () => engineRef.current,
        reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)")
          .matches,
      },
      setSeq,
    );
    clock.onStatus((next) => {
      setStatus(next);
      if (next === "ended") controller.advance();
    });
    clock.onFrame((seconds) => paintProgress(controller.state.index, seconds));
    clockRef.current = clock;
    engineRef.current = engine;
    controllerRef.current = controller;
    setPhase("running");
  }

  const beginRef = useRef(begin);
  beginRef.current = begin;
  useEffect(() => {
    if (!autoStart || autoStartedRef.current) return;
    autoStartedRef.current = true;
    void beginRef.current();
  }, [autoStart]);

  // Layout effect: the scene's finished markup is swapped for its first frame
  // before the browser paints, so it never flashes.
  useLayoutEffect(() => {
    const controller = controllerRef.current;
    const stage = stageRef.current;
    if (phase !== "running" || !controller || !stage) return;
    paintProgress(seq.index, 0);
    controller.mount(stage, seq);
    return () => controller.unmount();
  }, [phase, seq, paintProgress]);

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    engineRef.current?.setMuted(next);
  }

  const scene = sequence[seq.index];
  const finished = seq.done || sequence.length === 0;
  const progressPercent = Math.round(
    sequenceProgress(durations, seq.index, 0) * 100,
  );
  const progressText = scene
    ? `Scene ${seq.index + 1} of ${sequence.length}: ${scene.label}`
    : "";
  const finishedText = `Finished. ${formatCount(data.model.plan.total)} contributions.`;

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
            key={`${seq.run}-${scene.id}`}
            ref={stageRef}
            className="absolute inset-0"
          >
            {scene.instance.view}
          </div>
        )}
        {finished && (
          <div className="absolute inset-0 z-40 overflow-y-auto bg-paper">
            {finale.render(data, {
              replay: () => controllerRef.current?.replay(),
            })}
          </div>
        )}
      </div>

      <p className="sr-only" aria-live="polite">
        {finished ? finishedText : phase === "running" ? progressText : ""}
      </p>

      {phase !== "running" && sequence.length > 0 && (
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
        clock={clockRef.current ?? undefined}
        onToggleMute={toggleMute}
        ticks={ticks}
        fillRef={fillRef}
        progressText={finished ? "Finished" : progressText}
        progressPercent={finished ? 100 : progressPercent}
      />
    </ScreenMain>
  );
}
