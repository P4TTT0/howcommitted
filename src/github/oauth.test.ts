import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_RETURN_TO,
  exchangeCode,
  finishSignIn,
  STATE_COOKIE,
  safeReturnTo,
  startSignIn,
} from "./oauth";

const SECRET = "o".repeat(40);
const NOW = new Date("2026-10-17T12:00:00Z");
const APP = { clientId: "client-id", clientSecret: "client-secret" };
const TOKEN = "gho_16C7e42F292c6912E7710c838347Ae178B4a";

/** Starts sign-in and returns what the browser would hold and send back. */
function begin(returnTo: string | null = "/ada") {
  const { location, setCookie } = startSignIn(
    returnTo,
    APP.clientId,
    SECRET,
    NOW,
  );
  const state = new URL(location).searchParams.get("state") as string;
  const cookie = (setCookie.split(";")[0] as string).trim();
  return { location, setCookie, state, headers: new Headers({ cookie }) };
}

const githubReplies = (body: unknown, init?: ResponseInit) =>
  vi.fn(async () => new Response(JSON.stringify(body), init));

describe("safeReturnTo", () => {
  it("keeps same-origin relative paths", () => {
    for (const path of ["/", "/ada", "/ada?x=1", "/a-b/c_d", "/ada#top"]) {
      expect(safeReturnTo(path)).toBe(path);
    }
  });

  it("rejects absolute, protocol-relative and scheme URLs", () => {
    const hostile = [
      "https://evil.example",
      "http://evil.example/ada",
      "//evil.example",
      "///evil.example",
      "\\\\evil.example",
      "/\\evil.example",
      "\\/evil.example",
      "/.//evil.example",
      "javascript:alert(1)",
      "data:text/html,x",
      "evil.example",
      "ada",
      "",
    ];
    for (const value of hostile) expect(safeReturnTo(value)).toBe("/");
  });

  it("rejects control characters, whitespace and encoded line breaks' raw forms", () => {
    for (const value of [
      "/ada\r\nSet-Cookie: x=1",
      "/ada\n",
      "/a da",
      "/\t/x",
    ]) {
      expect(safeReturnTo(value)).toBe("/");
    }
  });

  it("rejects our own API (no sign-in loops) and oversized values", () => {
    expect(safeReturnTo("/api/auth/github")).toBe("/");
    expect(safeReturnTo("/api/history/ada")).toBe("/");
    expect(safeReturnTo(`/${"a".repeat(300)}`)).toBe("/");
  });

  it("falls back for missing values", () => {
    expect(safeReturnTo(null)).toBe(DEFAULT_RETURN_TO);
    expect(safeReturnTo(undefined)).toBe(DEFAULT_RETURN_TO);
  });
});

describe("startSignIn", () => {
  it("sends the visitor to GitHub with client id and state, and no scope or redirect_uri", () => {
    const { location } = begin();
    const url = new URL(location);
    expect(url.origin + url.pathname).toBe(
      "https://github.com/login/oauth/authorize",
    );
    expect([...url.searchParams.keys()].sort()).toEqual(["client_id", "state"]);
    expect(url.searchParams.get("client_id")).toBe(APP.clientId);
  });

  it("uses an unpredictable state each time", () => {
    const states = new Set(Array.from({ length: 20 }, () => begin().state));
    expect(states.size).toBe(20);
    expect(begin().state.length).toBeGreaterThanOrEqual(43);
  });

  it("binds the state to the browser with a sealed, HttpOnly, short-lived cookie", () => {
    const { setCookie, state } = begin();
    expect(setCookie).toContain(`${STATE_COOKIE}=`);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Path=/api/auth");
    expect(setCookie).toContain("Max-Age=600");
    expect(setCookie).not.toContain(state);
  });

  it("stores only a vetted return path", () => {
    const hostile = begin("https://evil.example");
    return finishSignIn(
      { code: "abc", state: hostile.state, error: null },
      hostile.headers,
      APP,
      SECRET,
      { now: NOW, fetchImpl: githubReplies({ access_token: TOKEN }) },
    ).then((outcome) => {
      expect(outcome).toMatchObject({ returnTo: "/" });
    });
  });
});

describe("finishSignIn", () => {
  it("exchanges the code for the token and returns to the saved path", async () => {
    const { state, headers } = begin("/ada");
    const fetchImpl = githubReplies({ access_token: TOKEN });
    const outcome = await finishSignIn(
      { code: "code123", state, error: null },
      headers,
      APP,
      SECRET,
      { now: NOW, fetchImpl },
    );
    expect(outcome).toEqual({
      kind: "signed_in",
      token: TOKEN,
      returnTo: "/ada",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("rejects a state that does not match the browser's, without calling GitHub", async () => {
    const { headers } = begin();
    const fetchImpl = githubReplies({ access_token: TOKEN });
    for (const state of ["attacker-state", "", null, `${begin().state}`]) {
      const outcome = await finishSignIn(
        { code: "code123", state, error: null },
        headers,
        APP,
        SECRET,
        { now: NOW, fetchImpl },
      );
      expect(outcome).toEqual({ kind: "invalid_state" });
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects a callback from a browser that never started sign-in", async () => {
    const { state } = begin();
    const fetchImpl = githubReplies({ access_token: TOKEN });
    const outcome = await finishSignIn(
      { code: "code123", state, error: null },
      new Headers(),
      APP,
      SECRET,
      { now: NOW, fetchImpl },
    );
    expect(outcome).toEqual({ kind: "invalid_state" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects an expired or tampered state cookie", async () => {
    const { state, headers } = begin();
    const fetchImpl = githubReplies({ access_token: TOKEN });
    const late = new Date(NOW.getTime() + 601_000);
    expect(
      await finishSignIn(
        { code: "c", state, error: null },
        headers,
        APP,
        SECRET,
        {
          now: late,
          fetchImpl,
        },
      ),
    ).toEqual({ kind: "invalid_state" });

    const cookie = headers.get("cookie") as string;
    const tampered = new Headers({ cookie: `${cookie.slice(0, -3)}AAA` });
    expect(
      await finishSignIn(
        { code: "c", state, error: null },
        tampered,
        APP,
        SECRET,
        {
          now: NOW,
          fetchImpl,
        },
      ),
    ).toEqual({ kind: "invalid_state" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("goes back anonymous when the visitor denied access", async () => {
    const { state, headers } = begin("/ada");
    const fetchImpl = githubReplies({ access_token: TOKEN });
    const outcome = await finishSignIn(
      { code: null, state, error: "access_denied" },
      headers,
      APP,
      SECRET,
      { now: NOW, fetchImpl },
    );
    expect(outcome).toEqual({ kind: "failed", returnTo: "/ada" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does not forward a malformed code to GitHub", async () => {
    const { state, headers } = begin();
    const fetchImpl = githubReplies({ access_token: TOKEN });
    const outcome = await finishSignIn(
      { code: "bad code&x=1", state, error: null },
      headers,
      APP,
      SECRET,
      { now: NOW, fetchImpl },
    );
    expect(outcome.kind).toBe("failed");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("goes back anonymous when GitHub refuses the code", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const { state, headers } = begin("/ada");
    const outcome = await finishSignIn(
      { code: "c", state, error: null },
      headers,
      APP,
      SECRET,
      {
        now: NOW,
        fetchImpl: githubReplies({ error: "bad_verification_code" }),
      },
    );
    expect(outcome).toEqual({ kind: "failed", returnTo: "/ada" });
    vi.restoreAllMocks();
  });
});

describe("exchangeCode", () => {
  it("posts the code with the app credentials, server to server", async () => {
    const fetchImpl = githubReplies({ access_token: TOKEN });
    expect(await exchangeCode("code123", APP, fetchImpl)).toBe(TOKEN);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://github.com/login/oauth/access_token");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      client_id: "client-id",
      client_secret: "client-secret",
      code: "code123",
    });
  });

  it("returns null and logs neither the token nor the secret on failure", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const cases: (() => Promise<Response>)[] = [
      async () =>
        new Response(JSON.stringify({ access_token: TOKEN }), { status: 500 }),
      async () => new Response("<html>", { status: 200 }),
      async () => new Response(JSON.stringify({ access_token: "bad token" })),
      async () =>
        new Response(JSON.stringify({ error: "bad_verification_code" })),
      async () => {
        throw new Error(`network down for ${APP.clientSecret} ${TOKEN}`);
      },
    ];
    for (const run of cases) {
      expect(await exchangeCode("c", APP, vi.fn(run))).toBeNull();
    }
    const logged = info.mock.calls.map((call) => String(call[0])).join("\n");
    expect(logged).toContain("oauth_exchange_failed");
    expect(logged).not.toContain(TOKEN);
    expect(logged).not.toContain(APP.clientSecret);
    info.mockRestore();
  });
});
