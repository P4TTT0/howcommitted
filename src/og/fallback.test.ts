import { describe, expect, it, vi } from "vitest";
import {
  FALLBACK_CACHE_CONTROL,
  firstThatRenders,
  lastResortImage,
} from "./fallback";

const ok = (text: string) => async () => new Response(text);

describe("firstThatRenders", () => {
  it("returns the first attempt that works", async () => {
    const second = vi.fn(ok("second"));
    const response = await firstThatRenders([ok("first"), second]);
    expect(await response.text()).toBe("first");
    expect(second).not.toHaveBeenCalled();
  });

  it("falls through a failing attempt to the next one", async () => {
    const onError = vi.fn();
    const response = await firstThatRenders(
      [
        async () => {
          throw new Error("font missing");
        },
        ok("fontless"),
      ],
      lastResortImage,
      onError,
    );
    expect(await response.text()).toBe("fontless");
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("answers 200 with a short-lived image when everything fails, never a 500", async () => {
    const boom = async () => {
      throw new Error("satori");
    };
    const response = await firstThatRenders(
      [boom, boom],
      lastResortImage,
      () => {},
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe(FALLBACK_CACHE_CONTROL);
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(20);
  });
});
