import { describe, expect, it } from "vitest";
import { createLock } from "./lock";
import { createTestStore } from "./test-store";

describe("createLock", () => {
  it("lets only one caller hold the lock until it is released", async () => {
    const lock = createLock(createTestStore().store, "");
    const release = await lock.acquire("Torvalds");
    expect(release).not.toBeNull();
    expect(await lock.acquire("torvalds")).toBeNull();

    await release?.();
    expect(await lock.acquire("torvalds")).not.toBeNull();
  });

  it("does not release a lock it no longer owns", async () => {
    const { store, values } = createTestStore();
    const lock = createLock(store, "");
    const release = await lock.acquire("a");
    values.set("v1:lock:a", "someone-else");
    await release?.();
    expect(values.get("v1:lock:a")).toBe("someone-else");
  });
});
