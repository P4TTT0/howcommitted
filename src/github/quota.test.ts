import type { Redis } from "@upstash/redis";
import { describe, expect, it, vi } from "vitest";

// In-memory sliding-window stand-in: same `limit(id)` contract as @upstash/ratelimit.
vi.mock("@upstash/ratelimit", () => {
  class Ratelimit {
    private used = new Map<string, number>();
    constructor(
      private options: { limiter: { max: number }; prefix: string },
    ) {}
    static slidingWindow(max: number) {
      return { max };
    }
    async limit(id: string) {
      const key = `${this.options.prefix}:${id}`;
      const count = (this.used.get(key) ?? 0) + 1;
      this.used.set(key, count);
      return { success: count <= this.options.limiter.max };
    }
  }
  return { Ratelimit };
});

import {
  CHARGE_SCRIPT,
  COLD_ATTEMPTS_PER_MINUTE,
  COLD_GENERATIONS_PER_DAY,
  createQuota,
  PREVIEWS_PER_MINUTE,
  PREVIEWS_PER_MINUTE_UNKNOWN_IP,
  REFUND_SCRIPT,
} from "./quota";

/** Fake Redis that understands the two quota scripts. Each eval is atomic, as in Redis. */
function fakeRedis() {
  const counts = new Map<string, number>();
  const ttls = new Map<string, number>();
  const failOn = new Set<string>();
  const redis = {
    eval: async (script: string, keys: string[], args: unknown[]) => {
      const key = keys[0] as string;
      if (failOn.has(key)) throw new Error("redis down");
      if (script === CHARGE_SCRIPT) {
        const count = (counts.get(key) ?? 0) + 1;
        counts.set(key, count);
        if (count === 1) ttls.set(key, Number(args[0]));
        return count;
      }
      if (script === REFUND_SCRIPT) {
        const count = counts.get(key) ?? 0;
        if (count <= 0) return 0;
        counts.set(key, count - 1);
        return count - 1;
      }
      throw new Error("unexpected script");
    },
  };
  return { redis: redis as unknown as Redis, counts, ttls, failOn };
}

const NOW = new Date("2026-10-16T12:00:00Z");
const DAY_KEY = "2026-10-16";
const cookieKey = (id: string) => `v1:quota:cold:cookie:${id}:${DAY_KEY}`;
const ipKey = (ip: string) => `v1:quota:cold:ip:${ip}:${DAY_KEY}`;

describe("anonymous cold quota", () => {
  it("allows two cold generations per cookie, then blocks", async () => {
    const quota = createQuota(fakeRedis().redis, "", () => NOW);
    const visitor = { ip: "1.1.1.1", cookieId: "c1" };
    expect(COLD_GENERATIONS_PER_DAY).toBe(2);
    expect(await quota.chargeColdGeneration(visitor)).not.toBeNull();
    expect(await quota.chargeColdGeneration(visitor)).not.toBeNull();
    expect(await quota.chargeColdGeneration(visitor)).toBeNull();
  });

  it("blocks a fresh cookie coming from an IP that is already exhausted", async () => {
    const quota = createQuota(fakeRedis().redis, "", () => NOW);
    await quota.chargeColdGeneration({ ip: "2.2.2.2", cookieId: "a" });
    await quota.chargeColdGeneration({ ip: "2.2.2.2", cookieId: "b" });
    expect(
      await quota.chargeColdGeneration({ ip: "2.2.2.2", cookieId: "c" }),
    ).toBeNull();
  });

  it("rolls back the other identity when one is over its limit", async () => {
    const { redis, counts } = fakeRedis();
    const quota = createQuota(redis, "", () => NOW);
    await quota.chargeColdGeneration({ ip: "3.3.3.3", cookieId: "a" });
    await quota.chargeColdGeneration({ ip: "3.3.3.3", cookieId: "b" });

    // The IP is exhausted: the fresh cookie must not lose a run for nothing.
    await quota.chargeColdGeneration({ ip: "3.3.3.3", cookieId: "fresh" });
    expect(counts.get(cookieKey("fresh"))).toBe(0);
    expect(counts.get(ipKey("3.3.3.3"))).toBe(2);

    // And the other way around: an exhausted cookie does not burn IP budget.
    await quota.chargeColdGeneration({ ip: "3.3.3.4", cookieId: "a" });
    expect(
      await quota.chargeColdGeneration({ ip: "3.3.3.4", cookieId: "a" }),
    ).toBeNull();
    expect(counts.get(cookieKey("a"))).toBe(2);
    expect(counts.get(ipKey("3.3.3.4"))).toBe(1);
  });

  it("cannot exceed the limit under concurrent charges", async () => {
    const { redis, counts } = fakeRedis();
    const quota = createQuota(redis, "", () => NOW);
    const results = await Promise.all(
      Array.from({ length: COLD_ATTEMPTS_PER_MINUTE }, () =>
        quota.chargeColdGeneration({ ip: "9.9.9.9", cookieId: "same" }),
      ),
    );
    expect(results.filter(Boolean)).toHaveLength(COLD_GENERATIONS_PER_DAY);
    expect(counts.get(cookieKey("same"))).toBe(COLD_GENERATIONS_PER_DAY);
    expect(counts.get(ipKey("9.9.9.9"))).toBe(COLD_GENERATIONS_PER_DAY);
  });

  it("rate limits cold attempts per IP even across fresh cookies", async () => {
    const quota = createQuota(fakeRedis().redis, "", () => NOW);
    const results: unknown[] = [];
    for (let i = 0; i <= COLD_ATTEMPTS_PER_MINUTE; i++) {
      results.push(
        await quota.chargeColdGeneration({ ip: "unknown", cookieId: `c${i}` }),
      );
    }
    expect(results.at(-1)).toBeNull();
  });

  it("gives the run back on refund, once, and never below zero", async () => {
    const { redis, counts } = fakeRedis();
    const quota = createQuota(redis, "", () => NOW);
    const visitor = { ip: "4.4.4.4", cookieId: "x" };
    const first = await quota.chargeColdGeneration(visitor);
    await quota.chargeColdGeneration(visitor);
    await first?.refund();
    await first?.refund();
    expect(counts.get(cookieKey("x"))).toBe(1);
    expect(await quota.chargeColdGeneration(visitor)).not.toBeNull();

    counts.set(cookieKey("x"), 0);
    await first?.refund();
    expect(counts.get(cookieKey("x"))).toBe(0);
  });

  it("sets the expiry together with the first charge", async () => {
    const { redis, ttls } = fakeRedis();
    const quota = createQuota(redis, "", () => NOW);
    await quota.chargeColdGeneration({ ip: "5.5.5.5", cookieId: "d" });
    expect(ttls.get(cookieKey("d"))).toBeGreaterThan(24 * 60 * 60);
  });

  it("starts a new counter each UTC day", async () => {
    let now = NOW;
    const quota = createQuota(fakeRedis().redis, "", () => now);
    const visitor = { ip: "5.5.5.5", cookieId: "d" };
    await quota.chargeColdGeneration(visitor);
    await quota.chargeColdGeneration(visitor);
    expect(await quota.chargeColdGeneration(visitor)).toBeNull();

    now = new Date("2026-10-17T00:00:01Z");
    expect(await quota.chargeColdGeneration(visitor)).not.toBeNull();
  });

  it("rolls back and throws when the store fails midway", async () => {
    const { redis, counts, failOn } = fakeRedis();
    const quota = createQuota(redis, "", () => NOW);
    failOn.add(ipKey("6.6.6.6"));
    await expect(
      quota.chargeColdGeneration({ ip: "6.6.6.6", cookieId: "z" }),
    ).rejects.toThrow("redis down");
    expect(counts.get(cookieKey("z"))).toBe(0);
  });

  it("does not share an IP counter between visitors with unknown IPs", async () => {
    const quota = createQuota(fakeRedis().redis, "", () => NOW);
    for (const cookieId of ["a", "b", "c", "d"]) {
      expect(
        await quota.chargeColdGeneration({ ip: "unknown", cookieId }),
      ).not.toBeNull();
    }
  });
});

describe("preview rate limit", () => {
  it("allows a burst up to the limit and then blocks that IP", async () => {
    const quota = createQuota(fakeRedis().redis, "");
    for (let i = 0; i < PREVIEWS_PER_MINUTE; i++) {
      expect(await quota.allowPreview("5.5.5.5")).toBe(true);
    }
    expect(await quota.allowPreview("5.5.5.5")).toBe(false);
    expect(await quota.allowPreview("6.6.6.6")).toBe(true);
  });

  it("applies a stricter limit to requests without a usable IP", async () => {
    const quota = createQuota(fakeRedis().redis, "");
    expect(PREVIEWS_PER_MINUTE_UNKNOWN_IP).toBeLessThan(PREVIEWS_PER_MINUTE);
    for (let i = 0; i < PREVIEWS_PER_MINUTE_UNKNOWN_IP; i++) {
      expect(await quota.allowPreview("unknown")).toBe(true);
    }
    expect(await quota.allowPreview("unknown")).toBe(false);
  });
});
