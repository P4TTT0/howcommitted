import { afterEach, describe, expect, it, vi } from "vitest";
import { githubGraphql } from "./graphql";

const rateLimit = {
  cost: 1,
  remaining: 4999,
  limit: 5000,
  resetAt: "2026-10-16T12:00:00Z",
};

function stubFetch(response: Response | Error) {
  const fetchMock = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), init);

afterEach(() => vi.unstubAllGlobals());

describe("githubGraphql", () => {
  it("returns data and the rate limit, sending the bearer token", async () => {
    const fetchMock = stubFetch(
      json({ data: { user: { login: "a" }, rateLimit } }),
    );
    const result = await githubGraphql<{ user: { login: string } }>(
      "secret",
      "query",
      { login: "a" },
    );
    expect(result).toMatchObject({ ok: true, rateLimit });
    const init = (
      fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    )[1];
    expect((init.headers as Record<string, string>).authorization).toBe(
      "bearer secret",
    );
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("maps a NOT_FOUND error", async () => {
    stubFetch(
      json({
        data: { user: null, rateLimit },
        errors: [{ type: "NOT_FOUND", message: "Could not resolve" }],
      }),
    );
    const result = await githubGraphql("t", "q", {});
    expect(result).toMatchObject({ ok: false, error: { kind: "not_found" } });
  });

  it("maps a RATE_LIMITED GraphQL error with its reset time", async () => {
    stubFetch(
      json({
        data: { rateLimit: { ...rateLimit, remaining: 0 } },
        errors: [{ type: "RATE_LIMITED" }],
      }),
    );
    const result = await githubGraphql("t", "q", {});
    expect(result).toMatchObject({
      ok: false,
      error: { kind: "rate_limited", resetAt: rateLimit.resetAt },
    });
  });

  it("maps HTTP 403 with exhausted headers to rate_limited", async () => {
    stubFetch(
      json(
        {},
        {
          status: 403,
          headers: {
            "x-ratelimit-remaining": "0",
            "x-ratelimit-reset": "1792152000",
          },
        },
      ),
    );
    const result = await githubGraphql("t", "q", {});
    expect(result).toMatchObject({
      ok: false,
      error: { kind: "rate_limited" },
    });
  });

  it("maps a 502 (GitHub killed a slow request) to timeout", async () => {
    stubFetch(new Response("bad gateway", { status: 502 }));
    expect(await githubGraphql("t", "q", {})).toMatchObject({
      ok: false,
      error: { kind: "timeout" },
    });
  });

  it("honors the caller's abort signal", async () => {
    const fetchMock = stubFetch(json({ data: { rateLimit } }));
    const controller = new AbortController();
    await githubGraphql("t", "q", {}, controller.signal);
    const init = (
      fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    )[1];
    controller.abort();
    expect((init.signal as AbortSignal).aborted).toBe(true);
  });

  it("maps a timeout while reading the body to timeout", async () => {
    const response = new Response("{}");
    vi.spyOn(response, "json").mockRejectedValue(
      Object.assign(new Error("aborted"), { name: "TimeoutError" }),
    );
    stubFetch(response);
    expect(await githubGraphql("t", "q", {})).toMatchObject({
      ok: false,
      error: { kind: "timeout" },
    });
  });

  it("maps an aborted request to timeout", async () => {
    const error = new Error("timed out");
    error.name = "TimeoutError";
    stubFetch(error);
    expect(await githubGraphql("t", "q", {})).toMatchObject({
      ok: false,
      error: { kind: "timeout" },
    });
  });

  it("maps other failures to upstream and never throws", async () => {
    stubFetch(new Error("socket hang up"));
    expect(await githubGraphql("t", "q", {})).toMatchObject({
      ok: false,
      error: { kind: "upstream", message: "socket hang up" },
    });

    stubFetch(json({ errors: [{ message: "Server error" }] }, { status: 500 }));
    expect(await githubGraphql("t", "q", {})).toMatchObject({
      ok: false,
      error: { kind: "upstream", message: "Server error" },
    });
  });

  it("maps a 401 to unauthorized so a rejected token can be told apart", async () => {
    stubFetch(json({ message: "Bad credentials" }, { status: 401 }));
    expect(await githubGraphql("t", "q", {})).toEqual({
      ok: false,
      error: { kind: "unauthorized" },
      rateLimit: null,
    });
  });
});
