import { describe, expect, it, vi } from "vitest";
import type { PlaybackClock } from "@/playback/clock";
import type { SoundEngine } from "@/playback/sound/engine";
import { SequenceController, type SequenceState } from "./controller";
import type { SequencedScene } from "./sequence";
import type { SceneRuntime } from "./types";

function fakeClock() {
  const clock = {
    speed: 1,
    loadScene: vi.fn(),
    start: vi.fn(),
    jumpToEnd: vi.fn(),
    dispose: vi.fn(),
    setSpeed: vi.fn((speed: number) => {
      clock.speed = speed;
    }),
  };
  return clock as unknown as PlaybackClock & typeof clock;
}

type SceneOptions = {
  mount?: (root: HTMLElement, runtime: SceneRuntime) => () => void;
  explore?: (root: HTMLElement, runtime: SceneRuntime) => () => void;
};

function scene(id: string, options: SceneOptions = {}): SequencedScene {
  return {
    id,
    label: id,
    instance: {
      duration: 5,
      bpm: 120,
      view: null,
      mount: options.mount ?? (() => () => {}),
      explore: options.explore,
    },
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

/** Mounts what the state says, like the sequencer's layout effect does. */
function show(controller: SequenceController) {
  controller.unmount();
  controller.mount(root, controller.state);
}

const three = () => [scene("a"), scene("b"), scene("c")];

describe("SequenceController", () => {
  it("mounts a scene on the shared clock and starts it", () => {
    const mount = vi.fn(() => () => {});
    const { clock, controller } = setup([scene("a", { mount })]);
    controller.mount(root, controller.state);
    expect(clock.loadScene).toHaveBeenCalledWith({ duration: 5, bpm: 120 });
    expect(mount).toHaveBeenCalledTimes(1);
    expect(clock.start).toHaveBeenCalledTimes(1);
  });

  it("holds in explore when a scene ends: it never advances by itself", () => {
    const explore = vi.fn(() => () => {});
    const { controller, states } = setup([scene("a", { explore }), scene("b")]);
    controller.mount(root, controller.state);
    controller.finishScene();
    expect(controller.state).toMatchObject({
      index: 0,
      done: false,
      mode: "explore",
    });
    expect(explore).toHaveBeenCalledTimes(1);
    // Ending again (a late clock event) changes nothing.
    controller.finishScene();
    expect(explore).toHaveBeenCalledTimes(1);
    expect(states.every((state) => state.index === 0 && !state.done)).toBe(
      true,
    );
  });

  it("holds the last scene too, and only goes to the finale on next", () => {
    const { controller } = setup([scene("a")]);
    controller.mount(root, controller.state);
    controller.finishScene();
    expect(controller.state).toMatchObject({ index: 0, done: false });
    controller.next();
    expect(controller.state).toMatchObject({ done: true, mode: "explore" });
  });

  it("goes to the next scene playing, then the finale", () => {
    const { controller } = setup([scene("a"), scene("b")]);
    controller.next();
    expect(controller.state).toMatchObject({
      index: 1,
      done: false,
      mode: "playing",
    });
    controller.next();
    expect(controller.state).toMatchObject({ index: 1, done: true });
    const before = controller.state;
    controller.next();
    expect(controller.state).toBe(before);
  });

  it("lands in explore when going back to a scene already played", () => {
    const { controller } = setup(three());
    controller.mount(root, controller.state);
    controller.finishScene();
    controller.next();
    expect(controller.state).toMatchObject({ index: 1, mode: "playing" });
    controller.prev();
    expect(controller.state).toMatchObject({ index: 0, mode: "explore" });
  });

  it("counts a scene left before it ended as played", () => {
    const { controller } = setup(three());
    controller.next();
    controller.prev();
    expect(controller.state).toMatchObject({ index: 0, mode: "explore" });
  });

  it("does not go before the first scene", () => {
    const { controller } = setup(three());
    const before = controller.state;
    controller.prev();
    expect(controller.state).toBe(before);
  });

  it("goes from the finale back to the last scene in explore", () => {
    const { controller } = setup([scene("a"), scene("b")]);
    controller.next();
    controller.next();
    expect(controller.state.done).toBe(true);
    controller.prev();
    expect(controller.state).toMatchObject({
      index: 1,
      done: false,
      mode: "explore",
    });
  });

  it("jumps to a scene: new ones play, played ones open in explore", () => {
    const { controller } = setup(three());
    controller.goTo(2);
    expect(controller.state).toMatchObject({ index: 2, mode: "playing" });
    controller.goTo(0);
    expect(controller.state).toMatchObject({ index: 0, mode: "explore" });
    // Scene 1 was jumped over, never played: it plays.
    controller.goTo(1);
    expect(controller.state).toMatchObject({ index: 1, mode: "playing" });
  });

  it("ignores a jump to the scene it is already on", () => {
    const { controller, states } = setup(three());
    controller.goTo(0);
    expect(states).toHaveLength(0);
  });

  it("clamps jumps to the sequence", () => {
    const { controller } = setup(three());
    controller.goTo(99);
    expect(controller.state.done).toBe(true);
    controller.goTo(-5);
    expect(controller.state).toMatchObject({ index: 0, done: false });
  });

  it("remounts on every move, with a new visit", () => {
    const { controller } = setup(three());
    const visits = [controller.state.visit];
    controller.next();
    visits.push(controller.state.visit);
    controller.prev();
    visits.push(controller.state.visit);
    controller.replayScene();
    visits.push(controller.state.visit);
    expect(new Set(visits).size).toBe(4);
  });

  it("mounts a scene landed on in explore at its end, silently, then explores", () => {
    const order: string[] = [];
    const explore = vi.fn(() => {
      order.push("explore");
      return () => {};
    });
    const mount = vi.fn(() => {
      order.push("mount");
      return () => {};
    });
    const { clock, controller } = setup([
      scene("a"),
      scene("b", { mount, explore }),
    ]);
    controller.goTo(1);
    controller.goTo(0);
    controller.goTo(1);
    expect(controller.state.mode).toBe("explore");
    controller.mount(root, controller.state);
    expect(order).toEqual(["mount", "explore"]);
    expect(clock.jumpToEnd).toHaveBeenCalledTimes(1);
    expect(clock.start).not.toHaveBeenCalled();
  });

  it("replays one scene from its start, with the clock running", () => {
    const { clock, controller } = setup(three());
    controller.mount(root, controller.state);
    controller.finishScene();
    controller.replayScene();
    expect(controller.state).toMatchObject({ index: 0, mode: "playing" });
    show(controller);
    expect(clock.start).toHaveBeenCalledTimes(2);
  });

  it("cleans explore before the scene, and each once", () => {
    const order: string[] = [];
    const { controller } = setup([
      scene("a", {
        mount: () => () => order.push("scene"),
        explore: () => () => order.push("explore"),
      }),
    ]);
    controller.mount(root, controller.state);
    controller.finishScene();
    controller.unmount();
    controller.unmount();
    expect(order).toEqual(["explore", "scene"]);
  });

  it("keeps a scene static when its explore throws", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { controller } = setup([
      scene("a", {
        explore: () => {
          throw new Error("broken");
        },
      }),
    ]);
    controller.mount(root, controller.state);
    expect(() => controller.finishScene()).not.toThrow();
    expect(controller.state.mode).toBe("explore");
    error.mockRestore();
  });

  it("hands every scene the same sound engine, so mute carries over", () => {
    const engine = { muted: false } as unknown as SoundEngine;
    const seen: Array<SoundEngine | null> = [];
    const spy = (_: HTMLElement, runtime: SceneRuntime) => {
      seen.push(runtime.sound());
      return () => {};
    };
    const { controller } = setup(
      [scene("a", { mount: spy }), scene("b", { mount: spy })],
      engine,
    );
    controller.mount(root, controller.state);
    controller.next();
    controller.mount(root, controller.state);
    expect(seen).toEqual([engine, engine]);
  });

  it("skips a scene whose mount throws and plays the next", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const second = vi.fn(() => () => {});
    const { clock, controller } = setup([
      scene("boom", {
        mount: () => {
          throw new Error("broken");
        },
      }),
      scene("ok", { mount: second }),
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
      scene("boom", {
        mount: () => {
          throw new Error("broken");
        },
      }),
    ]);
    controller.mount(root, controller.state);
    expect(controller.state.done).toBe(true);
    error.mockRestore();
  });

  it("mounts nothing on the finale", () => {
    const mount = vi.fn(() => () => {});
    const { controller } = setup([scene("a", { mount })]);
    controller.goTo(1);
    controller.mount(root, controller.state);
    expect(mount).not.toHaveBeenCalled();
  });

  it("replays from the first scene as a new run, and everything plays again", () => {
    const { controller } = setup([scene("a"), scene("b")]);
    controller.next();
    controller.next();
    controller.replay();
    expect(controller.state).toMatchObject({
      index: 0,
      run: 1,
      done: false,
      mode: "playing",
    });
    // Played again from scratch: nothing counts as played until it is left.
    expect(controller.hasPlayed(0)).toBe(false);
    expect(controller.hasPlayed(1)).toBe(false);
    controller.next();
    controller.prev();
    expect(controller.state.mode).toBe("explore");
  });

  describe("speed", () => {
    it("forwards the speed to the clock and the sound engine", () => {
      const engine = { setSpeed: vi.fn() } as unknown as SoundEngine & {
        setSpeed: ReturnType<typeof vi.fn>;
      };
      const { clock, controller } = setup(three(), engine);
      controller.setSpeed(1.5);
      expect(clock.setSpeed).toHaveBeenCalledWith(1.5);
      expect(engine.setSpeed).toHaveBeenCalledWith(1.5);
      expect(controller.playbackSpeed).toBe(1.5);
    });

    it("keeps the speed across scenes, replays and explore", () => {
      const { clock, controller } = setup(three());
      controller.setSpeed(2);
      controller.mount(root, controller.state);
      controller.finishScene();
      controller.next();
      show(controller);
      controller.prev();
      show(controller);
      controller.replayScene();
      show(controller);
      controller.replay();
      show(controller);
      expect(clock.speed).toBe(2);
      expect(clock.setSpeed).toHaveBeenCalledTimes(1);
      expect(controller.playbackSpeed).toBe(2);
    });

    it("ignores values that are not a speed", () => {
      const { clock, controller } = setup(three());
      controller.setSpeed(0);
      controller.setSpeed(Number.NaN);
      expect(clock.setSpeed).not.toHaveBeenCalled();
      expect(controller.playbackSpeed).toBe(1);
    });
  });

  describe("cancel", () => {
    it("unmounts the scene, disposes the clock and ignores later commands", () => {
      const cleanup = vi.fn();
      const exploreCleanup = vi.fn();
      const { clock, controller, states } = setup([
        scene("a", {
          mount: () => cleanup,
          explore: () => exploreCleanup,
        }),
        scene("b"),
      ]);
      controller.mount(root, controller.state);
      controller.finishScene();
      const emitted = states.length;
      controller.cancel();
      expect(cleanup).toHaveBeenCalledTimes(1);
      expect(exploreCleanup).toHaveBeenCalledTimes(1);
      expect(clock.dispose).toHaveBeenCalledTimes(1);

      controller.next();
      controller.prev();
      controller.goTo(1);
      controller.replay();
      controller.replayScene();
      controller.finishScene();
      controller.mount(root, controller.state);
      expect(states).toHaveLength(emitted);
      expect(clock.start).toHaveBeenCalledTimes(1);
    });

    it("is safe to call twice", () => {
      const { clock, controller } = setup(three());
      controller.cancel();
      controller.cancel();
      expect(clock.dispose).toHaveBeenCalledTimes(1);
    });
  });
});
