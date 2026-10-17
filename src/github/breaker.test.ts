import { afterEach, describe, expect, it, vi } from "vitest";
import { createBreaker, DEFAULT_LOCKOUT_MS } from "./breaker";
import { createTestStore } from "./test-store";

const NOW = new Date("2026-10-16T12:00:00Z");
const RESET = "2026-10-16T12:30:00Z";
const limit = (remaining: number, resetAt = RESET) => ({
  cost: 1,
  remaining,
  limit: 5000,
  resetAt,
});

afterEach(() => vi.restoreAllMocks());

describe("circuit breaker", () => {
  it("is closed with no data", async () => {
    const breaker = createBreaker(createTestStore().store, "");
    expect(await breaker.isOpen(NOW)).toBe(false);
  });

  it("opens when remaining drops below 20% of the limit", async () => {
    const breaker = createBreaker(createTestStore().store, "");
    await breaker.record(limit(1001), NOW);
    expect(await breaker.isOpen(NOW)).toBe(false);
    await breaker.record(limit(999), NOW);
    expect(await breaker.isOpen(NOW)).toBe(true);
  });

  it("closes again once the rate limit window has reset", async () => {
    const breaker = createBreaker(createTestStore().store, "");
    await breaker.record(limit(10), NOW);
    expect(await breaker.isOpen(new Date("2026-10-16T12:31:00Z"))).toBe(false);
  });

  it("ignores responses without rate limit info", async () => {
    const breaker = createBreaker(createTestStore().store, "");
    await breaker.record(null, NOW);
    expect(await breaker.isOpen(NOW)).toBe(false);
  });

  it("keeps the lowest remaining of out-of-order responses in one window", async () => {
    const breaker = createBreaker(createTestStore().store, "");
    await breaker.record(limit(500), NOW);
    await breaker.record(limit(2000), NOW);
    expect(await breaker.isOpen(NOW)).toBe(true);
  });

  it("takes the new value when the window changes", async () => {
    const breaker = createBreaker(createTestStore().store, "");
    await breaker.record(limit(500, RESET), NOW);
    await breaker.record(limit(4000, "2026-10-16T13:30:00Z"), NOW);
    expect(await breaker.isOpen(NOW)).toBe(false);
  });

  it("opens on a rate limit error until the reported reset", async () => {
    const breaker = createBreaker(createTestStore().store, "");
    await breaker.recordRateLimited(RESET, NOW);
    expect(await breaker.isOpen(NOW)).toBe(true);
    expect(await breaker.isOpen(new Date("2026-10-16T12:31:00Z"))).toBe(false);
  });

  it("assumes a short lockout when the reset time is unknown", async () => {
    const breaker = createBreaker(createTestStore().store, "");
    await breaker.recordRateLimited(null, NOW);
    expect(await breaker.isOpen(new Date(NOW.getTime() + 1000))).toBe(true);
    expect(
      await breaker.isOpen(new Date(NOW.getTime() + DEFAULT_LOCKOUT_MS + 1)),
    ).toBe(false);
  });

  it("logs one line per open/closed transition only", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const breaker = createBreaker(createTestStore().store, "");
    await breaker.record(limit(4000), NOW);
    await breaker.record(limit(900), NOW);
    await breaker.record(limit(800), NOW);
    await breaker.record(limit(4000, "2026-10-16T13:30:00Z"), NOW);
    const lines = info.mock.calls.map((call) => JSON.parse(String(call[0])));
    expect(lines.map((line) => [line.event, line.open])).toEqual([
      ["breaker", true],
      ["breaker", false],
    ]);
  });
});
