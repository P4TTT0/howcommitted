import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const allowAuthAttempt = vi.hoisted(() => vi.fn());
vi.mock("@/github/services", () => ({
  getServices: () => ({ quota: { allowAuthAttempt } }),
}));

import { readSession, SESSION_COOKIE } from "@/github/session";
import { GET as callback } from "./github/callback/route";
import { GET as signIn } from "./github/route";
import { POST as signOut } from "./signout/route";

const SECRET = "r".repeat(40);
const TOKEN = "gho_16C7e42F292c6912E7710c838347Ae178B4a";
const ORIGIN = "https://www.howcommitted.com";

beforeEach(() => {
  vi.stubEnv("AUTH_COOKIE_SECRET", SECRET);
  vi.stubEnv("GITHUB_OAUTH_CLIENT_ID", "client-id");
  vi.stubEnv("GITHUB_OAUTH_CLIENT_SECRET", "client-secret");
  vi.spyOn(console, "info").mockImplementation(() => {});
  allowAuthAttempt.mockReset();
  allowAuthAttempt.mockResolvedValue(true);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const cookiesOf = (response: Response) => response.headers.getSetCookie();
const pair = (setCookie: string) => (setCookie.split(";")[0] as string).trim();

/** GitHub: token endpoint, viewer lookup and token revocation. */
function stubGithub(login = "Ada") {
  const fetchMock = vi.fn(
    async (url: string | URL | Request, _init?: RequestInit) => {
      const target = String(url);
      if (target.endsWith("/user")) {
        return new Response(JSON.stringify({ login }));
      }
      if (target.includes("/applications/")) {
        return new Response(null, { status: 204 });
      }
      return new Response(JSON.stringify({ access_token: TOKEN }));
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Runs the sign-in start and returns what the browser holds. */
async function start(returnTo: string) {
  const response = await signIn(
    new Request(
      `${ORIGIN}/api/auth/github?returnTo=${encodeURIComponent(returnTo)}`,
    ),
  );
  const state = new URL(
    response.headers.get("location") as string,
  ).searchParams.get("state") as string;
  return { response, state, cookie: pair(cookiesOf(response)[0] as string) };
}

const callbackRequest = (state: string, cookie?: string, code = "abc123") =>
  new Request(
    `${ORIGIN}/api/auth/github/callback?code=${code}&state=${state}`,
    { headers: cookie ? { cookie } : undefined },
  );

describe("sign-in start", () => {
  it("redirects to GitHub and sets the state cookie", async () => {
    const { response } = await start("/ada");
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toMatch(
      /^https:\/\/github\.com\/login\/oauth\/authorize\?/,
    );
    expect(cookiesOf(response)[0]).toContain("HttpOnly");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("fails with a configuration error when the OAuth app is not configured", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("GITHUB_OAUTH_CLIENT_ID", "");
    const response = await signIn(new Request(`${ORIGIN}/api/auth/github`));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("GITHUB_OAUTH_CLIENT_ID");
  });

  it("redirects back without starting sign-in when the limiter store is down", async () => {
    allowAuthAttempt.mockRejectedValue(new Error("redis down"));
    const response = await signIn(
      new Request(`${ORIGIN}/api/auth/github?returnTo=/ada`),
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/ada");
    expect(cookiesOf(response)).toEqual([]);
    const hostile = await signIn(
      new Request(`${ORIGIN}/api/auth/github?returnTo=https://evil.example`),
    );
    expect(hostile.headers.get("location")).toBe("/");
  });

  it("is rate limited per IP", async () => {
    allowAuthAttempt.mockResolvedValue(false);
    const response = await signIn(
      new Request(`${ORIGIN}/api/auth/github`, {
        headers: { "x-real-ip": "203.0.113.9" },
      }),
    );
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(response.headers.get("location")).toBeNull();
    expect(allowAuthAttempt).toHaveBeenCalledWith("203.0.113.9");
  });
});

describe("callback", () => {
  it("signs in: sets an encrypted session cookie with the login and returns to the page, never exposing the token", async () => {
    const { state, cookie } = await start("/ada");
    stubGithub("Ada");
    const response = await callback(callbackRequest(state, cookie));

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/ada");
    const cookies = cookiesOf(response);
    const session = cookies.find((c) => c.startsWith(`${SESSION_COOKIE}=`));
    expect(session).toBeDefined();
    expect(session).toContain("HttpOnly");
    expect(session).toContain("SameSite=Lax");
    // The one-time state cookie is cleared.
    expect(cookies.some((c) => c.startsWith("hc_oauth=;"))).toBe(true);
    // Nothing the browser sees contains the token.
    expect(JSON.stringify([...response.headers])).not.toContain(TOKEN);
    expect(await response.text()).toBe("");
    // The server can read it back from the cookie, with whose token it is.
    expect(
      readSession(new Headers({ cookie: pair(session as string) }), new Date()),
    ).toEqual({ token: TOKEN, login: "Ada" });
  });

  it("is rate limited per IP before anything reaches GitHub", async () => {
    const { state, cookie } = await start("/ada");
    const github = stubGithub();
    allowAuthAttempt.mockResolvedValue(false);
    const response = await callback(callbackRequest(state, cookie));
    expect(response.status).toBe(429);
    expect(github).not.toHaveBeenCalled();
  });

  it("redirects back, clears the state cookie and never redeems the code when the limiter store is down", async () => {
    const { state, cookie } = await start("/ada");
    const github = stubGithub();
    allowAuthAttempt.mockRejectedValue(new Error("redis down code=abc123"));
    const response = await callback(callbackRequest(state, cookie));
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/ada");
    expect(cookiesOf(response).some((c) => c.startsWith("hc_oauth=;"))).toBe(
      true,
    );
    expect(
      cookiesOf(response).some((c) => c.startsWith(`${SESSION_COOKIE}=`)),
    ).toBe(false);
    expect(github).not.toHaveBeenCalled();
    const noState = await callback(callbackRequest("x"));
    expect(noState.headers.get("location")).toBe("/");
  });

  it("rejects a forged state with a 400 and no session", async () => {
    const { cookie } = await start("/ada");
    const exchange = vi.fn();
    vi.stubGlobal("fetch", exchange);
    const response = await callback(callbackRequest("forged", cookie));
    expect(response.status).toBe(400);
    expect(
      cookiesOf(response).some((c) => c.startsWith(`${SESSION_COOKIE}=`)),
    ).toBe(false);
    expect(exchange).not.toHaveBeenCalled();
  });

  it("rejects a callback with no state cookie (login CSRF)", async () => {
    const { state } = await start("/ada");
    vi.stubGlobal("fetch", vi.fn());
    const response = await callback(callbackRequest(state));
    expect(response.status).toBe(400);
  });

  it("never redirects off-site, even with a hostile returnTo", async () => {
    const { state, cookie } = await start("https://evil.example/phish");
    stubGithub();
    const response = await callback(callbackRequest(state, cookie));
    expect(response.headers.get("location")).toBe("/");
  });

  it("returns to the page without a session when GitHub refuses", async () => {
    const { state, cookie } = await start("/ada");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "bad_verification_code" })),
      ),
    );
    const response = await callback(callbackRequest(state, cookie));
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/ada");
    expect(
      cookiesOf(response).some(
        (c) =>
          c.startsWith(`${SESSION_COOKIE}=`) &&
          !c.startsWith(`${SESSION_COOKIE}=;`),
      ),
    ).toBe(false);
  });
});

describe("sign-out", () => {
  const post = (path: string, headers?: Record<string, string>) =>
    signOut(
      new Request(`${ORIGIN}/api/auth/signout${path}`, {
        method: "POST",
        headers,
      }),
    );

  it("clears the session cookie and returns to the page", async () => {
    const response = await post("?returnTo=/ada", { origin: ORIGIN });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/ada");
    expect(cookiesOf(response)[0]).toMatch(/^hc_session=; Path=\/; Max-Age=0/);
  });

  it("does not redirect off-site", async () => {
    const response = await post("?returnTo=//evil.example", {
      origin: ORIGIN,
    });
    expect(response.headers.get("location")).toBe("/");
  });

  it("refuses a cross-site request", async () => {
    const response = await post("", { origin: "https://evil.example" });
    expect(response.status).toBe(403);
    expect(cookiesOf(response)).toEqual([]);
  });

  it("refuses a request with no Origin unless the browser says it is same-origin", async () => {
    expect((await post("")).status).toBe(403);
    expect((await post("", { "sec-fetch-site": "cross-site" })).status).toBe(
      403,
    );
    expect((await post("", { "sec-fetch-site": "none" })).status).toBe(403);
    expect((await post("", { "sec-fetch-site": "same-origin" })).status).toBe(
      303,
    );
  });

  it("revokes the token at GitHub, best effort, and clears the cookie either way", async () => {
    const { state, cookie } = await start("/ada");
    stubGithub();
    const signedIn = await callback(callbackRequest(state, cookie));
    const session = pair(
      cookiesOf(signedIn).find((c) =>
        c.startsWith(`${SESSION_COOKIE}=`),
      ) as string,
    );

    const github = stubGithub();
    const response = await post("", {
      origin: ORIGIN,
      cookie: session,
    });
    expect(response.status).toBe(303);
    const [url, init] = github.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://api.github.com/applications/client-id/token");
    expect(init.method).toBe("DELETE");

    // GitHub failing must not fail the sign-out, nor leak the token to logs.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error(`network ${TOKEN}`);
      }),
    );
    const failing = await post("", { origin: ORIGIN, cookie: session });
    expect(failing.status).toBe(303);
    expect(cookiesOf(failing)[0]).toMatch(/Max-Age=0/);
    const logged = vi
      .mocked(console.info)
      .mock.calls.map((call) => String(call[0]))
      .join("\n");
    expect(logged).not.toContain(TOKEN);
  });
});
