"use client";

import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { type ClockStatus, PlaybackClock } from "@/playback/clock";
import { SoundEngine } from "@/playback/sound/engine";
import { ScenePositionContext } from "@/ui/SceneFrame";
import { ScreenMain } from "@/ui/ScreenMain";
import { Controls, type ControlsView, STAGE_BOTTOM_CLASS } from "./Controls";
import {
  INITIAL_STATE,
  SequenceController,
  type SequenceState,
} from "./controller";
import { formatCount } from "./model/format";
import { StartGate, type StartPhase } from "./StartGate";
import { buildSequence, sequenceProgress } from "./sequence";
import { type Shortcut, shortcutFor } from "./shortcuts";
import { nextSpeed, readSpeed, type Speed, writeSpeed } from "./speed";
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
  /**
   * The user cancelled (the Cancel control or Esc). Playback and sound are
   * already stopped when this runs; it only has to leave.
   */
  onCancel: () => void;
};

/**
 * Runs the scenes on one clock, then the finale. It owns everything around the
 * scenes: start gate, sound engine, the clock, controls, keyboard shortcuts,
 * progress and the moves between scenes (see `SequenceController`). A scene
 * that ends holds in explore until the user moves on. With no playable scene
 * it shows the finale at once.
 */
export function Sequencer({
  data,
  scenes,
  finale,
  caption,
  title,
  autoStart = false,
  starting,
  onCancel,
}: SequencerProps) {
  const sequence = useMemo(() => buildSequence(scenes, data), [scenes, data]);
  const count = sequence.length;
  const trackScenes = useMemo(
    () => sequence.map(({ id, label }) => ({ id, label })),
    [sequence],
  );

  const durations = useMemo(
    () => sequence.map((scene) => scene.instance.duration),
    [sequence],
  );

  const stageRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const clockRef = useRef<PlaybackClock | null>(null);
  const engineRef = useRef<SoundEngine | null>(null);
  const controllerRef = useRef<SequenceController | null>(null);
  const mountedRef = useRef(true);
  const cancelledRef = useRef(false);
  const autoStartedRef = useRef(false);
  const speedRef = useRef<Speed>(1);

  const [phase, setPhase] = useState<StartPhase>("start");
  const [status, setStatus] = useState<ClockStatus>("idle");
  const [seq, setSeq] = useState<SequenceState>(INITIAL_STATE);
  const seqRef = useRef(seq);
  seqRef.current = seq;
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const [failed, setFailed] = useState(false);
  const [stopped, setStopped] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    // The speed chosen earlier in this session; read after hydration.
    const stored = readSpeed();
    speedRef.current = stored;
    setSpeed(stored);
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
    if (!mountedRef.current || cancelledRef.current) {
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
      // The scene ran out: hold on it (explore). Moving on is the user's call.
      if (next === "ended") controller.finishScene();
    });
    // Mirror the clock position on the bar as `data-progress` (0..1); written
    // straight to the DOM so a frame never re-renders React.
    clock.onFrame((seconds) => {
      const duration = durations[controller.state.index] ?? 0;
      const fraction = duration > 0 ? Math.min(1, seconds / duration) : 0;
      const track = trackRef.current;
      if (track) track.dataset.progress = fraction.toFixed(2);
    });
    clockRef.current = clock;
    engineRef.current = engine;
    controllerRef.current = controller;
    controller.setSpeed(speedRef.current);
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
  // before the browser paints, so it never flashes. It re-runs only when a
  // scene is (re)mounted (`visit`) or the finale takes over; a scene ending
  // (playing -> explore) keeps the same mount.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `seq.visit` and `seq.done` are the triggers; the rest is read from the ref
  useLayoutEffect(() => {
    const controller = controllerRef.current;
    if (phase !== "running" || !controller) return;
    const current = seqRef.current;
    if (current.done) return;
    const stage = stageRef.current;
    if (!stage) return;
    controller.mount(stage, current);
    return () => controller.unmount();
  }, [phase, seq.visit, seq.done]);

  // A scene just ended: if focus sat on the pause button (now "Replay"), move
  // it to the way forward so Enter or Space cannot replay by accident.
  useEffect(() => {
    if (seq.mode !== "explore" || seq.done) return;
    if (document.activeElement === toggleRef.current) nextRef.current?.focus();
  }, [seq.mode, seq.done]);

  const view: ControlsView =
    phase !== "running"
      ? "idle"
      : seq.done || count === 0
        ? "finale"
        : seq.mode === "explore"
          ? "explore"
          : "playing";

  const togglePause = () => {
    const clock = clockRef.current;
    if (!clock) return;
    if (clock.status === "playing") clock.pause();
    else if (clock.status === "paused") clock.resume();
  };

  /** Replay: this scene while exploring one, the whole sequence from the finale. */
  const replay = () => {
    const controller = controllerRef.current;
    if (!controller) return;
    if (controller.state.done) controller.replay();
    else controller.replayScene();
  };

  const chooseSpeed = (next: Speed) => {
    speedRef.current = next;
    setSpeed(next);
    writeSpeed(next);
    controllerRef.current?.setSpeed(next);
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    engineRef.current?.setMuted(next);
  };

  /** Stops clock and sound at once, then hands over to the caller. */
  const cancel = () => {
    if (cancelledRef.current) return;
    cancelledRef.current = true;
    controllerRef.current?.cancel();
    clockRef.current = null;
    controllerRef.current = null;
    engineRef.current?.dispose();
    engineRef.current = null;
    setStopped(true);
    onCancel();
  };

  const act = (shortcut: Shortcut) => {
    const controller = controllerRef.current;
    const running = phase === "running" && controller;
    switch (shortcut) {
      case "mute":
        toggleMute();
        return;
      case "cancel":
        cancel();
        return;
      case "toggle":
        if (!running) return;
        // Space replays a finished scene; the finale has its own Replay.
        if (view === "playing") togglePause();
        else if (view === "explore") replay();
        return;
      case "prev":
        if (running) controller.prev();
        return;
      case "next":
        if (running) controller.next();
        return;
    }
  };

  const actRef = useRef(act);
  actRef.current = act;
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const shortcut = shortcutFor(event);
      if (!shortcut) return;
      event.preventDefault();
      actRef.current(shortcut);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (stopped) return <ScreenMain />;

  const scene = sequence[seq.index];
  const finished = seq.done || count === 0;
  const progressPercent = Math.round(
    sequenceProgress(count, seq.index, seq.mode === "explore" ? 1 : 0) * 100,
  );
  const progressText = scene
    ? `Scene ${seq.index + 1} of ${count}: ${scene.label}`
    : "";
  const finishedText = data.versus
    ? "Finished. Every developer's contributions are summarized."
    : `Finished. ${formatCount(data.model.plan.total)} contributions.`;
  const exploreText = `${progressText}. Scene finished. Explore the chart, or press Next.`;

  return (
    <ScreenMain>
      {title && (
        <h1 className="sr-only" tabIndex={-1}>
          {title}
        </h1>
      )}
      <div
        data-scene-frame=""
        className={`absolute inset-x-0 top-0 ${STAGE_BOTTOM_CLASS}`}
      >
        {scene && !finished && (
          <div
            key={`${seq.run}-${seq.visit}-${scene.id}`}
            ref={stageRef}
            className="absolute inset-0"
          >
            <ScenePositionContext value={{ index: seq.index, count }}>
              {scene.instance.view}
            </ScenePositionContext>
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
        {finished
          ? finishedText
          : phase !== "running"
            ? ""
            : view === "explore"
              ? exploreText
              : progressText}
      </p>

      {phase !== "running" && count > 0 && (
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
        view={view}
        paused={status === "paused"}
        muted={muted}
        speed={speed}
        scenes={trackScenes}
        index={seq.index}
        canPrev={phase === "running" && (finished ? count > 0 : seq.index > 0)}
        canNext={phase === "running" && !finished}
        trackRef={trackRef}
        progressText={finished ? "Finished" : progressText}
        progressPercent={finished ? 100 : progressPercent}
        toggleRef={toggleRef}
        nextRef={nextRef}
        onToggle={togglePause}
        onPrev={() => controllerRef.current?.prev()}
        onNext={() => controllerRef.current?.next()}
        onReplay={replay}
        onJump={(index) => controllerRef.current?.goTo(index)}
        onCycleSpeed={() => chooseSpeed(nextSpeed(speed))}
        onMute={toggleMute}
        onCancel={cancel}
      />
    </ScreenMain>
  );
}
