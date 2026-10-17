import { describe, expect, it } from "vitest";
import { mapWithConcurrency } from "./concurrency";

describe("mapWithConcurrency", () => {
  it("never exceeds the limit and keeps input order", async () => {
    let inFlight = 0;
    let peak = 0;
    const result = await mapWithConcurrency(
      Array.from({ length: 12 }, (_, i) => i),
      3,
      async (n) => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight--;
        return n * 2;
      },
    );
    expect(peak).toBe(3);
    expect(result).toEqual(Array.from({ length: 12 }, (_, i) => i * 2));
  });

  it("stops launching new items once shouldStop is true", async () => {
    let started = 0;
    const result = await mapWithConcurrency(
      [1, 2, 3, 4, 5, 6],
      2,
      async (n) => {
        started++;
        await new Promise((resolve) => setTimeout(resolve, 5));
        return n;
      },
      () => started >= 2,
    );
    expect(started).toBe(2);
    expect(result).toEqual([1, 2]);
  });

  it("handles an empty list", async () => {
    expect(await mapWithConcurrency([], 6, async (n) => n)).toEqual([]);
  });
});
