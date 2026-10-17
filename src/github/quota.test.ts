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
  COLD_GENERATIONS_PER_DAY,
  createQuota,
  PREVIEWS_PER_MINUTE,
  PREVIEWS_PER_MINUTE_UNKNOWN_IP,
} from "./quota";

function fakeRedis() {
  const counts = new Map<string, number>();
  const redis = {
    get: async (key: string) => counts.get(key) ?? null,
    incr: async (key: string) => {
      counts.set(key, (counts.get(key) ?? 0) + 1);
      return counts.get(key);
    },
    decr: async (key: string) => {
      counts.set(key, (counts.get(key) ?? 0) - 1);
      return counts.get(key);
    },
    expire: vi.fn(async () => 1),
  };
  return { redis: redis as unknown as Redis, counts, expire: redis.expire };
}

const NOW = new Date("2026-10-16T12:00:00Z");

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

  it("checks both identities before charging either", async () => {
    const { redis, counts } = fakeRedis();
    const quota = createQuota(redis, "", () => NOW);
    await quota.chargeColdGeneration({ ip: "3.3.3.3", cookieId: "a" });
    await quota.chargeColdGeneration({ ip: "3.3.3.3", cookieId: "b" });

    // The IP is exhausted: the fresh cookie must not lose a run for nothing.
    await quota.chargeColdGeneration({ ip: "3.3.3.3", cookieId: "fresh" });
    expect(counts.get("v1:quota:cold:cookie:fresh:2026-10-16")).toBeUndefined();
  });

  it("gives the run back on refund", async () => {
    const quota = createQuota(fakeRedis().redis, "", () => NOW);
    const visitor = { ip: "4.4.4.4", cookieId: "x" };
    const first = await quota.chargeColdGeneration(visitor);
    await quota.chargeColdGeneration(visitor);
    await first?.refund();
    expect(await quota.chargeColdGeneration(visitor)).not.toBeNull();
  });

  it("starts a new counter each UTC day and expires old ones", async () => {
    const { redis, expire } = fakeRedis();
    let now = NOW;
    const quota = createQuota(redis, "p:", () => now);
    const visitor = { ip: "5.5.5.5", cookieId: "d" };
    await quota.chargeColdGeneration(visitor);
    await quota.chargeColdGeneration(visitor);
    expect(await quota.chargeColdGeneration(visitor)).toBeNull();

    now = new Date("2026-10-17T00:00:01Z");
    expect(await quota.chargeColdGeneration(visitor)).not.toBeNull();
    expect(expire).toHaveBeenCalledWith(
      "p:v1:quota:cold:cookie:d:2026-10-16",
      expect.any(Number),
    );
  });

  it("does not share an IP bucket between visitors with unknown IPs", async () => {
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
