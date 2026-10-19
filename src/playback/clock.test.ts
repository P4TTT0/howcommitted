import { beforeEach, describe, expect, it, vi } from "vitest";

const audio = vi.hoisted(() => ({
  lookAhead: 0.1,
  outputLatency: undefined as number | undefined,
}));

const transport = vi.hoisted(() => ({
  ticks: 0,
  PPQ: 192,
  position: 0 as number | string,
  bpm: { value: 0 },
  schedule: vi.fn(),
  cancel: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  pause: vi.fn(),
}));

vi.mock("tone", () => ({
  getTransport: () => transport,
  getContext: () => ({
    lookAhead: audio.lookAhead,
    rawContext: { outputLatency: audio.outputLatency },
  }),
  start: vi.fn(async () => {}),
}));

import { PlaybackClock } from "./clock";

/** Ticks in one second of a 120 bpm scene at 192 PPQ. */
const TPS = 384;

let frames: Array<() => void> = [];
let visibility: Array<() => void> = [];
const doc = { hidden: false };

function runFrame() {
  const pending = frames;
  frames = [];
  for (const frame of pending) frame();
}

beforeEach(() => {
  frames = [];
  visibility = [];
  doc.hidden = false;
  transport.ticks = 0;
  audio.lookAhead = 0.1;
  audio.outputLatency = undefined;
  vi.clearAllMocks();
  vi.stubGlobal("requestAnimationFrame", (callback: () => void) => {
    frames.push(callback);
    return frames.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {
    frames = [];
  });
  vi.stubGlobal("document", {
    get hidden() {
      return doc.hidden;
    },
    addEventListener: (_: string, listener: () => void) =>
      visibility.push(listener),
    removeEventListener: (_: string, listener: () => void) => {
      visibility = visibility.filter((entry) => entry !== listener);
    },
  });
});

describe("PlaybackClock", () => {
  it("starts idle and configures the Transport", () => {
    const clock = new PlaybackClock({ duration: 10, bpm: 120 });
    expect(clock.status).toBe("idle");
    expect(transport.bpm.value).toBe(120);
  });

  it("moves through start, pause, resume", () => {
    const clock = new PlaybackClock({ duration: 10, bpm: 120 });
    clock.start();
    expect(clock.status).toBe("playing");
    clock.pause();
    expect(clock.status).toBe("paused");
    expect(transport.pause).toHaveBeenCalledTimes(1);
    clock.resume();
    expect(clock.status).toBe("playing");
    expect(transport.start).toHaveBeenCalledTimes(2);
  });

  it("ignores pause when not playing and resume when not paused", () => {
    const clock = new PlaybackClock({ duration: 10, bpm: 120 });
    clock.pause();
    clock.resume();
    expect(clock.status).toBe("idle");
    expect(transport.pause).not.toHaveBeenCalled();
  });

  it("emits an exact last frame on finish", () => {
    const clock = new PlaybackClock({ duration: 10, bpm: 120 });
    const seen: number[] = [];
    clock.onFrame((seconds) => seen.push(seconds));
    clock.start();
    clock.jumpToEnd();
    expect(seen.at(-1)).toBe(10);
  });

  it("finishes from the frame loop once Transport time reaches the duration", () => {
    const clock = new PlaybackClock({ duration: 10, bpm: 120 });
    clock.start();
    transport.ticks = 5 * TPS;
    runFrame();
    expect(clock.status).toBe("playing");
    transport.ticks = 10.05 * TPS;
    runFrame();
    expect(clock.status).toBe("ended");
    expect(transport.pause).toHaveBeenCalled();
  });

  it("pauses when the tab is hidden and does not resume by itself", () => {
    const clock = new PlaybackClock({ duration: 10, bpm: 120 });
    clock.start();
    doc.hidden = true;
    for (const listener of visibility) listener();
    expect(clock.status).toBe("paused");
    doc.hidden = false;
    for (const listener of visibility) listener();
    expect(clock.status).toBe("paused");
  });

  it("loads the next scene on the same clock", () => {
    const clock = new PlaybackClock({ duration: 10, bpm: 120 });
    const statuses: string[] = [];
    clock.onStatus((status) => statuses.push(status));
    clock.start();
    clock.jumpToEnd();
    clock.loadScene({ duration: 4, bpm: 140 });
    expect(clock.status).toBe("idle");
    expect(clock.duration).toBe(4);
    expect(transport.bpm.value).toBe(140);
    expect(transport.cancel).toHaveBeenCalled();
    expect(transport.position).toBe(0);
    clock.start();
    transport.ticks = 4.05 * ((192 * 140) / 60);
    runFrame();
    expect(statuses.at(-1)).toBe("ended");
    expect(visibility).toHaveLength(1);
  });

  it("clamps visible time to the duration and removes listeners on dispose", () => {
    const clock = new PlaybackClock({ duration: 10, bpm: 120 });
    transport.ticks = 99 * TPS;
    expect(clock.seconds).toBe(10);
    transport.ticks = 0;
    expect(clock.seconds).toBe(0);
    clock.dispose();
    expect(visibility).toHaveLength(0);
    expect(transport.cancel).toHaveBeenCalled();
  });

  it("schedules hits in ticks of the scene's own tempo", () => {
    const clock = new PlaybackClock({ duration: 10, bpm: 120 });
    const callback = vi.fn();
    clock.at(2, callback);
    expect(transport.schedule).toHaveBeenCalledWith(callback, `${2 * TPS}i`);
  });

  it("scales the Transport tempo by the speed and keeps it across scenes", () => {
    const clock = new PlaybackClock({ duration: 10, bpm: 120 });
    clock.setSpeed(2);
    expect(clock.speed).toBe(2);
    expect(transport.bpm.value).toBe(240);
    clock.loadScene({ duration: 4, bpm: 140 });
    expect(transport.bpm.value).toBe(280);
    expect(clock.speed).toBe(2);
  });

  it("schedules at the scene's tempo whatever the speed, so hits keep their place", () => {
    const clock = new PlaybackClock({ duration: 10, bpm: 120 });
    clock.setSpeed(2);
    const callback = vi.fn();
    clock.at(2, callback);
    expect(transport.schedule).toHaveBeenCalledWith(callback, `${2 * TPS}i`);
  });

  it("reads scene time from ticks, not from real seconds, at any speed", () => {
    const clock = new PlaybackClock({ duration: 10, bpm: 120 });
    clock.setSpeed(2);
    transport.ticks = 5 * TPS;
    // Look-ahead (0.1 s of real time) is 0.2 scene seconds at 2x.
    expect(clock.seconds).toBeCloseTo(4.8);
    runFrame();
    clock.start();
    transport.ticks = 10.05 * TPS;
    runFrame();
    expect(clock.status).toBe("ended");
  });

  it("drives frames from the audible time, one look-ahead behind the Transport", () => {
    const clock = new PlaybackClock({ duration: 10, bpm: 120 });
    const seen: number[] = [];
    clock.onFrame((seconds) => seen.push(seconds));
    clock.start();
    transport.ticks = 3 * TPS;
    runFrame();
    expect(seen.at(-1)).toBeCloseTo(2.9);
  });

  it("also subtracts the output latency the browser reports", () => {
    audio.outputLatency = 0.04;
    const clock = new PlaybackClock({ duration: 10, bpm: 120 });
    transport.ticks = 3 * TPS;
    expect(clock.seconds).toBeCloseTo(2.86);
  });

  it("ignores speeds that are not positive numbers", () => {
    const clock = new PlaybackClock({ duration: 10, bpm: 120 });
    clock.setSpeed(0);
    clock.setSpeed(-1);
    clock.setSpeed(Number.NaN);
    expect(clock.speed).toBe(1);
    expect(transport.bpm.value).toBe(120);
  });

  it("jumps to the end of a loaded scene without playing it", () => {
    const clock = new PlaybackClock({ duration: 10, bpm: 120 });
    const seen: number[] = [];
    clock.onFrame((seconds) => seen.push(seconds));
    clock.loadScene({ duration: 4, bpm: 120 });
    clock.jumpToEnd();
    expect(clock.status).toBe("ended");
    expect(seen.at(-1)).toBe(4);
    expect(transport.start).not.toHaveBeenCalled();
  });
});
