import { describe, expect, it, vi } from "vitest";
import { countTicks, fillTicks } from "./gestures";
import { scheduleCount, scheduleFill } from "./ticks";

function fakeClock() {
  const events: { seconds: number; run: (time: number) => void }[] = [];
  return {
    events,
    clock: {
      at: (seconds: number, run: (time: number) => void) =>
        events.push({ seconds, run }),
    },
  };
}

function fakeEngine() {
  return {
    fillTick: vi.fn(),
    countTick: vi.fn(),
    countClose: vi.fn(),
  };
}

describe("scheduleFill", () => {
  it("schedules one clock event per tick and starts nothing itself", () => {
    const { clock, events } = fakeClock();
    const engine = fakeEngine();
    scheduleFill(clock, () => engine, 2, 1, { from: 0.2, to: 0.8, db: -3 });
    const ticks = fillTicks(1, 0.2, 0.8);
    expect(events).toHaveLength(ticks.length);
    expect(events.map((e) => e.seconds)).toEqual(
      ticks.map((t) => 2 + t.offset),
    );
    expect(engine.fillTick).not.toHaveBeenCalled();

    events[1]?.run(9);
    expect(engine.fillTick).toHaveBeenCalledWith(9, ticks[1]?.rate, -3);
  });

  it("is silent when the engine is gone", () => {
    const { clock, events } = fakeClock();
    scheduleFill(clock, () => null, 0, 1);
    expect(() => events[0]?.run(1)).not.toThrow();
  });
});

describe("scheduleCount", () => {
  it("schedules the ticks and the closing hit", () => {
    const { clock, events } = fakeClock();
    const engine = fakeEngine();
    scheduleCount(clock, () => engine, 1, 2, 3);
    const ticks = countTicks(2, 3);
    expect(events.map((e) => e.seconds)).toEqual([
      ...ticks.map((t) => 1 + t.offset),
      3,
    ]);
    for (const event of events) event.run(5);
    expect(engine.countTick).toHaveBeenCalledTimes(3);
    expect(engine.countTick).toHaveBeenCalledWith(5, ticks[2]?.progress);
    expect(engine.countClose).toHaveBeenCalledWith(5);
  });
});
