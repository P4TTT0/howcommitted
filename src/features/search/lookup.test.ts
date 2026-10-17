import { describe, expect, it, vi } from "vitest";
import {
  activeSpan,
  canRetry,
  checkInput,
  formatActiveSpan,
  interpretLookup,
  lookupLogin,
  lookupMessage,
  normalizeLogin,
  type PreviewUser,
} from "./lookup";

const user: PreviewUser = {
  login: "torvalds",
  name: "Linus Torvalds",
  avatarUrl: "https://example.test/a.png",
  createdAt: "2011-09-03T15:26:22Z",
  contributionYears: [2025, 2024, 2012, 2011],
};

describe("checkInput", () => {
  it("is empty for blank input", () => {
    expect(checkInput("")).toEqual({ kind: "empty" });
    expect(checkInput("   ")).toEqual({ kind: "empty" });
    expect(checkInput("@")).toEqual({ kind: "empty" });
  });

  it("accepts valid logins, trimming spaces and a leading @", () => {
    expect(checkInput("  @torvalds ")).toEqual({
      kind: "valid",
      login: "torvalds",
    });
    expect(normalizeLogin("@ada-l")).toBe("ada-l");
  });

  it("flags logins that collide with app routes", () => {
    expect(checkInput("lab")).toEqual({ kind: "reserved", login: "lab" });
  });

  it("rejects what GitHub would never allow, without a request", () => {
    for (const bad of ["-ada", "ada-", "a--b", "a/b", "a b", "x".repeat(40)]) {
      expect(checkInput(bad)).toEqual({ kind: "invalid" });
    }
  });
});

describe("interpretLookup", () => {
  it("finds a user", () => {
    expect(interpretLookup("torvalds", 200, { user })).toEqual({
      kind: "found",
      user,
    });
  });

  it("treats a malformed success body as a failure", () => {
    expect(interpretLookup("x", 200, { user: { login: 1 } }).kind).toBe(
      "failed",
    );
    expect(interpretLookup("x", 200, null).kind).toBe("failed");
  });

  it("maps statuses to states", () => {
    expect(interpretLookup("ghost", 404, null)).toEqual({
      kind: "not_found",
      login: "ghost",
    });
    expect(interpretLookup("x", 404, null).kind).toBe("not_found");
    expect(interpretLookup("x", 400, null).kind).toBe("invalid");
    expect(interpretLookup("x", 500, null).kind).toBe("failed");
    expect(interpretLookup("x", 502, null).kind).toBe("failed");
  });
});

describe("interpretLookup when asked to slow down", () => {
  const ipLimit = { error: { code: "rate_limited", reason: "ip_limit" } };
  const circuit = { error: { code: "degraded", reason: "circuit_open" } };

  it("blames our own limiter on traffic, not on GitHub", () => {
    expect(interpretLookup("x", 429, ipLimit, "30")).toEqual({
      kind: "unavailable",
      cause: "traffic",
      retryAfterSeconds: 30,
    });
  });

  it("blames GitHub for an open circuit or a bare 429", () => {
    expect(interpretLookup("x", 503, circuit).kind).toBe("unavailable");
    expect(interpretLookup("x", 503, circuit)).toMatchObject({
      cause: "github",
    });
    expect(interpretLookup("x", 429, null)).toMatchObject({ cause: "github" });
  });

  it("treats other degraded reasons as traffic", () => {
    const busy = { error: { code: "degraded", reason: "busy" } };
    expect(interpretLookup("x", 503, busy)).toMatchObject({ cause: "traffic" });
  });
});

describe("lookupLogin", () => {
  const json = (status: number, body: unknown, headers?: HeadersInit) =>
    new Response(JSON.stringify(body), { status, headers });

  it("returns the interpreted state", async () => {
    const fetcher = vi.fn().mockResolvedValue(json(200, { user }));
    const state = await lookupLogin(
      "torvalds",
      new AbortController().signal,
      fetcher,
    );
    expect(state).toEqual({ kind: "found", user });
    expect(fetcher.mock.calls[0]?.[0]).toBe("/api/user/torvalds");
  });

  it("reads Retry-After for the wait", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(json(429, null, { "retry-after": "120" }));
    const state = await lookupLogin("x", new AbortController().signal, fetcher);
    expect(state).toMatchObject({
      kind: "unavailable",
      retryAfterSeconds: 120,
    });
  });

  it("reports an unreachable server as a network problem", async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError("offline"));
    const state = await lookupLogin("x", new AbortController().signal, fetcher);
    expect(state).toEqual({ kind: "network" });
  });

  it("drops a stale answer that arrives after the lookup was aborted", async () => {
    const controller = new AbortController();
    let answer: (response: Response) => void = () => {};
    const fetcher = vi.fn().mockReturnValue(
      new Promise<Response>((resolve) => {
        answer = resolve;
      }),
    );
    const pending = lookupLogin("old", controller.signal, fetcher);
    controller.abort(); // the user typed something else
    answer(json(200, { user }));
    expect(await pending).toBeNull();
  });

  it("drops an abort error instead of calling it a failure", async () => {
    const controller = new AbortController();
    const fetcher = vi.fn().mockImplementation(async () => {
      controller.abort();
      throw new DOMException("aborted", "AbortError");
    });
    expect(await lookupLogin("x", controller.signal, fetcher)).toBeNull();
  });
});

describe("copy", () => {
  it("describes each state without judging anyone", () => {
    expect(lookupMessage({ kind: "idle" })).toBe("");
    expect(lookupMessage({ kind: "looking", login: "ada" })).toBe(
      "Looking up @ada",
    );
    expect(lookupMessage({ kind: "not_found", login: "ghost" })).toBe(
      "No GitHub user named @ghost",
    );
    expect(
      lookupMessage({
        kind: "unavailable",
        cause: "github",
        retryAfterSeconds: null,
      }),
    ).toBe("GitHub needs a breather. Try again in a minute.");
    expect(
      lookupMessage({
        kind: "unavailable",
        cause: "traffic",
        retryAfterSeconds: 180,
      }),
    ).toBe("Too many requests right now. Try again in 3 minutes.");
    expect(lookupMessage({ kind: "network" })).toBe(
      "Could not reach Committed. Check your connection.",
    );
  });

  it("offers a retry only when trying again can help", () => {
    expect(
      canRetry({ kind: "unavailable", cause: "github", retryAfterSeconds: 5 }),
    ).toBe(true);
    expect(canRetry({ kind: "network" })).toBe(true);
    expect(canRetry({ kind: "failed" })).toBe(true);
    expect(canRetry({ kind: "not_found", login: "x" })).toBe(false);
    expect(canRetry({ kind: "found", user })).toBe(false);
  });
});

describe("activeSpan", () => {
  it("spans the first and last contribution year", () => {
    expect(activeSpan([2025, 2012, 2018])).toEqual({ first: 2012, last: 2025 });
    expect(formatActiveSpan([2020])).toBe("Active in 2020");
    expect(formatActiveSpan([])).toBe("No contribution years yet");
  });
});
