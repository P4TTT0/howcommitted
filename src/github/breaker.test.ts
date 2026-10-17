import { describe, expect, it } from "vitest";
import { createBreaker } from "./breaker";
import { createMemoryStore } from "./memory-store";

const NOW = new Date("2026-10-16T12:00:00Z");
const limit = (remaining: number, resetAt = "2026-10-16T12:30:00Z") => ({
  cost: 1,
  remaining,
  limit: 5000,
  resetAt,
});

describe("circuit breaker", () => {
  it("is closed with no data", async () => {
    const breaker = createBreaker(createMemoryStore().store, "");
    expect(await breaker.isOpen(NOW)).toBe(false);
  });

  it("opens when remaining drops below 20% of the limit", async () => {
    const breaker = createBreaker(createMemoryStore().store, "");
    await breaker.record(limit(1001));
    expect(await breaker.isOpen(NOW)).toBe(false);
    await breaker.record(limit(999));
    expect(await breaker.isOpen(NOW)).toBe(true);
  });

  it("closes again once the rate limit window has reset", async () => {
    const breaker = createBreaker(createMemoryStore().store, "");
    await breaker.record(limit(10));
    expect(await breaker.isOpen(new Date("2026-10-16T12:31:00Z"))).toBe(false);
  });

  it("ignores responses without rate limit info", async () => {
    const breaker = createBreaker(createMemoryStore().store, "");
    await breaker.record(null);
    expect(await breaker.isOpen(NOW)).toBe(false);
  });
});
