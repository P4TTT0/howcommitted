import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { isValidLogin } from "@/domain/login";
import { logEvent } from "./log";
import { open, seal } from "./seal";
import { cookieHeader, isPlausibleToken } from "./session";
import { readCookie } from "./visitor";

/**
 * GitHub "Sign in with GitHub" (OAuth app web flow), public data only: no
 * `scope` is ever requested and no `redirect_uri` is sent, so GitHub uses the
 * callback URL registered on the app and a forged request cannot ask for another.
 */
const AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const TOKEN_URL = "https://github.com/login/oauth/access_token";
const EXCHANGE_TIMEOUT_MS = 10_000;

/** Short-lived cookie binding the `state` value to the browser that started sign-in. */
export const STATE_COOKIE = "hc_oauth";
const STATE_PURPOSE = "oauth-state";
const STATE_TTL_SECONDS = 600;
const STATE_PATH = "/api/auth";

export const DEFAULT_RETURN_TO = "/";
const MAX_RETURN_TO_LENGTH = 200;
/** RFC 3986 path, query and fragment characters. Excludes backslash, whitespace, quotes and control characters. */
const RETURN_TO_CHARS = /^\/[A-Za-z0-9\-._~!$&'()*+,;=:@%/?#]*$/;
const PARSE_BASE = "https://base.invalid";

/**
 * Where to send the visitor after signing in or out. Only a same-origin path
 * is accepted; anything else (absolute or protocol-relative URLs, backslashes,
 * encoded tricks, our own API) falls back to "/". This is the open-redirect gate.
 */
export function safeReturnTo(value: string | null | undefined): string {
  if (
    !value ||
    value.length > MAX_RETURN_TO_LENGTH ||
    !RETURN_TO_CHARS.test(value) ||
    value.startsWith("//")
  ) {
    return DEFAULT_RETURN_TO;
  }
  try {
    const parsed = new URL(value, PARSE_BASE);
    if (
      parsed.origin !== PARSE_BASE ||
      parsed.pathname.startsWith("//") ||
      parsed.pathname.startsWith("/api/")
    ) {
      return DEFAULT_RETURN_TO;
    }
  } catch {
    return DEFAULT_RETURN_TO;
  }
  return value;
}

type StatePayload = { state: string; returnTo: string };

export function startSignIn(
  returnTo: string | null | undefined,
  clientId: string,
  secret: string,
  now: Date = new Date(),
): { location: string; setCookie: string } {
  const state = randomBytes(32).toString("base64url");
  const payload: StatePayload = { state, returnTo: safeReturnTo(returnTo) };
  const location = new URL(AUTHORIZE_URL);
  location.searchParams.set("client_id", clientId);
  location.searchParams.set("state", state);
  return {
    location: location.toString(),
    setCookie: cookieHeader(
      STATE_COOKIE,
      seal(STATE_PURPOSE, payload, secret, STATE_TTL_SECONDS, now),
      { path: STATE_PATH, maxAge: STATE_TTL_SECONDS },
    ),
  };
}

export function clearStateCookie(): string {
  return cookieHeader(STATE_COOKIE, "", { path: STATE_PATH, maxAge: 0 });
}

function readState(
  headers: Headers,
  secret: string,
  now: Date,
): StatePayload | null {
  const data = open(
    STATE_PURPOSE,
    readCookie(headers, STATE_COOKIE),
    secret,
    now,
  ) as Partial<StatePayload> | null;
  if (typeof data?.state !== "string" || typeof data.returnTo !== "string") {
    return null;
  }
  return { state: data.state, returnTo: safeReturnTo(data.returnTo) };
}

/** The return path saved at sign-in start, or "/" when there is no valid state cookie. */
export function savedReturnTo(
  headers: Headers,
  secret: string,
  now: Date = new Date(),
): string {
  return readState(headers, secret, now)?.returnTo ?? DEFAULT_RETURN_TO;
}

/** Constant-time comparison; hashing first makes the lengths equal. */
function sameState(a: string, b: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(a), digest(b));
}

/** Trades the one-time code for the visitor's token. Never logs or returns GitHub's body. */
export async function exchangeCode(
  code: string,
  app: { clientId: string; clientSecret: string },
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  try {
    const response = await fetchImpl(TOKEN_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "user-agent": "howcommitted",
      },
      body: JSON.stringify({
        client_id: app.clientId,
        client_secret: app.clientSecret,
        code,
      }),
      signal: AbortSignal.timeout(EXCHANGE_TIMEOUT_MS),
      cache: "no-store",
    });
    const body = (await response.json()) as {
      access_token?: unknown;
      token_type?: unknown;
    };
    if (!response.ok || !isPlausibleToken(body.access_token)) {
      logEvent("oauth_exchange_failed", { status: response.status });
      return null;
    }
    return body.access_token;
  } catch (error) {
    // Only the error class: a message could echo request details.
    logEvent("oauth_exchange_failed", {
      reason: error instanceof Error ? error.name : "unknown",
    });
    return null;
  }
}

const VIEWER_URL = "https://api.github.com/user";

/**
 * Whose token this is. The session remembers it so a visitor's own profile is
 * always fetched with the server token (their token may see more than the
 * public does, and that must never reach the shared cache).
 */
export async function fetchViewerLogin(
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  try {
    const response = await fetchImpl(VIEWER_URL, {
      headers: {
        authorization: `bearer ${token}`,
        accept: "application/vnd.github+json",
        "user-agent": "howcommitted",
      },
      signal: AbortSignal.timeout(EXCHANGE_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const { login } = (await response.json()) as { login?: unknown };
    return typeof login === "string" && isValidLogin(login) ? login : null;
  } catch {
    return null;
  }
}

const REVOKE_TIMEOUT_MS = 3_000;

/**
 * Best-effort: asks GitHub to invalidate the token on sign-out. Bounded by a
 * short timeout, never throws, never logs the token.
 */
export async function revokeToken(
  token: string,
  app: { clientId: string; clientSecret: string },
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  try {
    const basic = Buffer.from(`${app.clientId}:${app.clientSecret}`).toString(
      "base64",
    );
    const response = await fetchImpl(
      `https://api.github.com/applications/${encodeURIComponent(app.clientId)}/token`,
      {
        method: "DELETE",
        headers: {
          authorization: `Basic ${basic}`,
          accept: "application/vnd.github+json",
          "content-type": "application/json",
          "user-agent": "howcommitted",
        },
        body: JSON.stringify({ access_token: token }),
        signal: AbortSignal.timeout(REVOKE_TIMEOUT_MS),
        cache: "no-store",
      },
    );
    if (!response.ok) {
      logEvent("oauth_revoke_failed", { status: response.status });
    }
  } catch (error) {
    logEvent("oauth_revoke_failed", {
      reason: error instanceof Error ? error.name : "unknown",
    });
  }
}

export type CallbackOutcome =
  /** Signed in: store the token, then go back. */
  | { kind: "signed_in"; token: string; login: string; returnTo: string }
  /** The state was fine but no session was created (denied, bad code, GitHub down): go back anonymous. */
  | { kind: "failed"; returnTo: string }
  /** Missing, expired or mismatched state: do not trust the request at all. */
  | { kind: "invalid_state" };

const CODE_PATTERN = /^[A-Za-z0-9_-]{1,200}$/;

/**
 * Finishes sign-in. The state is verified first, so an attacker cannot make a
 * victim's browser redeem a code of the attacker's choosing (login CSRF).
 */
export async function finishSignIn(
  params: {
    code: string | null;
    state: string | null;
    error: string | null;
  },
  headers: Headers,
  app: { clientId: string; clientSecret: string },
  secret: string,
  options: { now?: Date; fetchImpl?: typeof fetch } = {},
): Promise<CallbackOutcome> {
  const saved = readState(headers, secret, options.now ?? new Date());
  if (!saved || !params.state || !sameState(saved.state, params.state)) {
    return { kind: "invalid_state" };
  }
  const { returnTo } = saved;
  if (params.error || !params.code || !CODE_PATTERN.test(params.code)) {
    return { kind: "failed", returnTo };
  }
  const token = await exchangeCode(params.code, app, options.fetchImpl);
  if (!token) return { kind: "failed", returnTo };
  const login = await fetchViewerLogin(token, options.fetchImpl);
  if (!login) {
    // A session without a known login would be unsafe to use: do not create one.
    logEvent("oauth_viewer_failed", {});
    await revokeToken(token, app, options.fetchImpl);
    return { kind: "failed", returnTo };
  }
  return { kind: "signed_in", token, login, returnTo };
}
