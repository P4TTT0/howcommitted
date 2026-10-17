import { beforeEach, describe, expect, it, vi } from "vitest";

const transport = vi.hoisted(() => ({
  seconds: 0,
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
  getContext: () => ({ lookAhead: 0.1 }),
  start: vi.fn(async () => {}),
}));

import { PlaybackClock } from "./clock";

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
  transport.seconds = 0;
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

  it("skips to the end only while playing or paused", () => {
    const clock = new PlaybackClock({ duration: 10, bpm: 120 });
    clock.skip();
    expect(clock.status).toBe("idle");
    clock.start();
    clock.skip();
    expect(clock.status).toBe("ended");
  });

  it("emits an exact last frame on finish", () => {
    const clock = new PlaybackClock({ duration: 10, bpm: 120 });
    const seen: number[] = [];
    clock.onFrame((seconds) => seen.push(seconds));
    clock.start();
    clock.skip();
    expect(seen.at(-1)).toBe(10);
  });

  it("finishes from the frame loop once Transport time reaches the duration", () => {
    const clock = new PlaybackClock({ duration: 10, bpm: 120 });
    clock.start();
    transport.seconds = 5;
    runFrame();
    expect(clock.status).toBe("playing");
    transport.seconds = 10.05;
    runFrame();
    expect(clock.status).toBe("ended");
    expect(transport.pause).toHaveBeenCalled();
  });

  it("restarts from zero and plays again", () => {
    const clock = new PlaybackClock({ duration: 10, bpm: 120 });
    clock.start();
    clock.skip();
    clock.restart();
    expect(transport.stop).toHaveBeenCalled();
    expect(transport.position).toBe(0);
    expect(clock.status).toBe("playing");
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

  it("clamps visible time to the duration and removes listeners on dispose", () => {
    const clock = new PlaybackClock({ duration: 10, bpm: 120 });
    transport.seconds = 99;
    expect(clock.seconds).toBe(10);
    transport.seconds = 0;
    expect(clock.seconds).toBe(0);
    clock.dispose();
    expect(visibility).toHaveLength(0);
    expect(transport.cancel).toHaveBeenCalled();
  });
});
