import { beforeEach, describe, expect, it, vi } from "vitest";

const start = vi.fn();
const getContext = vi.fn();
vi.mock("tone", () => ({ start, getContext }));

async function load() {
  vi.resetModules();
  return import("./unlock");
}

beforeEach(() => {
  start.mockReset().mockResolvedValue(undefined);
  getContext.mockReset().mockReturnValue({ state: "running" });
});

describe("unlock", () => {
  it("starts locked and never touches Tone to answer", async () => {
    const { isAudioUnlocked } = await load();
    expect(isAudioUnlocked()).toBe(false);
    expect(getContext).not.toHaveBeenCalled();
  });

  it("unlocks when the context ends up running", async () => {
    const { unlockAudio, isAudioUnlocked } = await load();
    await expect(unlockAudio()).resolves.toBe(true);
    expect(isAudioUnlocked()).toBe(true);
  });

  it("calls Tone.start synchronously once Tone is preloaded", async () => {
    const { preloadAudio, unlockAudio } = await load();
    await preloadAudio();
    const pending = unlockAudio();
    expect(start).toHaveBeenCalledTimes(1);
    await pending;
  });

  it("falls back to awaiting the import when the click comes first", async () => {
    const { unlockAudio } = await load();
    const pending = unlockAudio();
    expect(start).not.toHaveBeenCalled();
    await pending;
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("stays locked when the context is still suspended", async () => {
    getContext.mockReturnValue({ state: "suspended" });
    const { unlockAudio, isAudioUnlocked } = await load();
    await expect(unlockAudio()).resolves.toBe(false);
    expect(isAudioUnlocked()).toBe(false);
  });

  it("stays locked when starting throws", async () => {
    start.mockRejectedValue(new Error("blocked"));
    const { unlockAudio, isAudioUnlocked } = await load();
    await expect(unlockAudio()).resolves.toBe(false);
    expect(isAudioUnlocked()).toBe(false);
  });

  it("notices when the context is suspended again later", async () => {
    const { unlockAudio, isAudioUnlocked } = await load();
    await unlockAudio();
    getContext.mockReturnValue({ state: "suspended" });
    expect(isAudioUnlocked()).toBe(false);
  });
});
