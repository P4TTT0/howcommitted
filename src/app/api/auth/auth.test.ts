import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readSessionToken, SESSION_COOKIE } from "@/github/session";
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
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const cookiesOf = (response: Response) => response.headers.getSetCookie();
const pair = (setCookie: string) => (setCookie.split(";")[0] as string).trim();

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
    {
      headers: cookie ? { cookie } : undefined,
    },
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
});

describe("callback", () => {
  it("signs in: sets an encrypted session cookie and returns to the page, never exposing the token", async () => {
    const { state, cookie } = await start("/ada");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ access_token: TOKEN }))),
    );
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
    // The server can read it back from the cookie.
    const token = readSessionToken(
      new Headers({ cookie: pair(session as string) }),
      new Date(),
    );
    expect(token).toBe(TOKEN);
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
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ access_token: TOKEN }))),
    );
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
  const post = (path: string, origin?: string) =>
    signOut(
      new Request(`${ORIGIN}/api/auth/signout${path}`, {
        method: "POST",
        headers: origin ? { origin } : undefined,
      }),
    );

  it("clears the session cookie and returns to the page", async () => {
    const response = await post("?returnTo=/ada", ORIGIN);
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/ada");
    expect(cookiesOf(response)[0]).toMatch(/^hc_session=; Path=\/; Max-Age=0/);
  });

  it("does not redirect off-site", async () => {
    const response = await post("?returnTo=//evil.example", ORIGIN);
    expect(response.headers.get("location")).toBe("/");
  });

  it("refuses a cross-site request", async () => {
    const response = await post("", "https://evil.example");
    expect(response.status).toBe(403);
    expect(cookiesOf(response)).toEqual([]);
  });
});
