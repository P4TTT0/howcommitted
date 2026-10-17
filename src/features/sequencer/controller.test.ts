import { describe, expect, it, vi } from "vitest";
import type { PlaybackClock } from "@/playback/clock";
import type { SoundEngine } from "@/playback/sound/engine";
import { SequenceController, type SequenceState } from "./controller";
import type { SequencedScene } from "./sequence";
import type { SceneRuntime } from "./types";

function fakeClock() {
  return {
    loadScene: vi.fn(),
    start: vi.fn(),
    resetHold: vi.fn(),
  } as unknown as PlaybackClock & {
    loadScene: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    resetHold: ReturnType<typeof vi.fn>;
  };
}

function scene(
  id: string,
  mount: (root: HTMLElement, runtime: SceneRuntime) => () => void,
): SequencedScene {
  return {
    id,
    label: id,
    instance: { duration: 5, bpm: 120, view: null, mount },
  };
}

const root = {} as HTMLElement;

function setup(scenes: SequencedScene[], engine: SoundEngine | null = null) {
  const clock = fakeClock();
  const states: SequenceState[] = [];
  const controller = new SequenceController(
    scenes,
    clock,
    { sound: () => engine, reducedMotion: false },
    (state) => states.push(state),
  );
  return { clock, controller, states };
}

describe("SequenceController", () => {
  it("mounts a scene on the shared clock and starts it", () => {
    const mount = vi.fn(() => () => {});
    const { clock, controller } = setup([scene("a", mount)]);
    controller.mount(root, controller.state);
    expect(clock.loadScene).toHaveBeenCalledWith({ duration: 5, bpm: 120 });
    expect(mount).toHaveBeenCalledTimes(1);
    expect(clock.start).toHaveBeenCalledTimes(1);
  });

  it("advances scene by scene, then to the finale", () => {
    const { controller } = setup([
      scene("a", () => () => {}),
      scene("b", () => () => {}),
    ]);
    controller.advance();
    expect(controller.state).toMatchObject({ index: 1, done: false });
    controller.advance();
    expect(controller.state).toMatchObject({ index: 1, done: true });
  });

  it("hands every scene the same sound engine, so mute carries over", () => {
    const engine = { muted: false } as unknown as SoundEngine;
    const seen: Array<SoundEngine | null> = [];
    const spy = (_: HTMLElement, runtime: SceneRuntime) => {
      seen.push(runtime.sound());
      return () => {};
    };
    const { controller } = setup([scene("a", spy), scene("b", spy)], engine);
    controller.mount(root, controller.state);
    controller.advance();
    controller.mount(root, controller.state);
    expect(seen).toEqual([engine, engine]);
  });

  it("skips a scene whose mount throws and plays the next", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const second = vi.fn(() => () => {});
    const { clock, controller } = setup([
      scene("boom", () => {
        throw new Error("broken");
      }),
      scene("ok", second),
    ]);
    controller.mount(root, controller.state);
    expect(clock.start).not.toHaveBeenCalled();
    expect(controller.state).toMatchObject({ index: 1, done: false });
    controller.mount(root, controller.state);
    expect(second).toHaveBeenCalledTimes(1);
    expect(clock.start).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });

  it("goes to the finale when the last scene throws", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { controller } = setup([
      scene("boom", () => {
        throw new Error("broken");
      }),
    ]);
    controller.mount(root, controller.state);
    expect(controller.state.done).toBe(true);
    error.mockRestore();
  });

  it("runs the scene cleanup on unmount, once", () => {
    const cleanup = vi.fn();
    const { controller } = setup([scene("a", () => cleanup)]);
    controller.mount(root, controller.state);
    controller.unmount();
    controller.unmount();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("replays from the first scene with a new run and no held pause", () => {
    const { clock, controller } = setup([
      scene("a", () => () => {}),
      scene("b", () => () => {}),
    ]);
    controller.advance();
    controller.advance();
    controller.replay();
    expect(clock.resetHold).toHaveBeenCalled();
    expect(controller.state).toEqual({ index: 0, run: 1, done: false });
  });
});
