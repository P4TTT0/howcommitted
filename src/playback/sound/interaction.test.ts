import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInteractionChannel } from "./interaction";

let now = 1000;
let unlocked = true;
const play = vi.fn();

function make() {
  const channel = createInteractionChannel({
    now: () => now,
    isUnlocked: () => unlocked,
    play,
  });
  channel.setEnabled(true);
  return channel;
}

beforeEach(() => {
  now = 1000;
  unlocked = true;
  play.mockReset();
});

describe("interaction channel", () => {
  it("is silent until enabled", () => {
    const channel = createInteractionChannel({
      now: () => now,
      isUnlocked: () => unlocked,
      play,
    });
    channel.hover(0.5);
    channel.click();
    expect(play).not.toHaveBeenCalled();
  });

  it("is silent before a user gesture unlocked audio", () => {
    unlocked = false;
    const channel = make();
    channel.hover(0.5);
    channel.click();
    expect(play).not.toHaveBeenCalled();
  });

  it("is silent again when sound is turned off", () => {
    const channel = make();
    channel.setEnabled(false);
    channel.click();
    expect(play).not.toHaveBeenCalled();
  });

  it("plays hover at a pitch that encodes the level, quietly", () => {
    const channel = make();
    channel.hover(1, "a");
    const [sound, rate, db] = play.mock.calls[0] ?? [];
    expect(sound).toBe("hover");
    expect(rate).toBeCloseTo(1.4);
    expect(db).toBeLessThan(-12);
  });

  it("throttles hover to one per 60ms", () => {
    const channel = make();
    channel.hover(0.1, "a");
    now += 30;
    channel.hover(0.9, "b");
    expect(play).toHaveBeenCalledTimes(1);
    now += 40;
    channel.hover(0.9, "b");
    expect(play).toHaveBeenCalledTimes(2);
  });

  it("skips the same target until the pointer leaves", () => {
    const channel = make();
    channel.hover(0.5, "bar");
    now += 200;
    channel.hover(0.5, "bar");
    expect(play).toHaveBeenCalledTimes(1);
    channel.leave();
    channel.hover(0.5, "bar");
    expect(play).toHaveBeenCalledTimes(2);
  });

  it("does not throttle clicks", () => {
    const channel = make();
    channel.click();
    channel.click();
    expect(play).toHaveBeenCalledTimes(2);
    expect(play.mock.calls[0]?.[0]).toBe("click");
  });
});
