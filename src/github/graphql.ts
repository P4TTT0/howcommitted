import "server-only";

const ENDPOINT = "https://api.github.com/graphql";
/** GitHub kills requests over 10 s, so give up slightly earlier. */
export const REQUEST_TIMEOUT_MS = 9_000;
const MS_PER_SECOND = 1_000;

export type RateLimitInfo = {
  cost: number;
  remaining: number;
  limit: number;
  resetAt: string;
};

export type GithubError =
  | { kind: "not_found" }
  | { kind: "rate_limited"; resetAt: string | null }
  | { kind: "timeout" }
  | { kind: "upstream"; message: string };

export type GraphqlResult<T> =
  | { ok: true; data: T; rateLimit: RateLimitInfo | null }
  | { ok: false; error: GithubError; rateLimit: RateLimitInfo | null };

type GraphqlBody<T> = {
  data?: (T & { rateLimit?: RateLimitInfo }) | null;
  errors?: { type?: string; message?: string }[];
};

/** Every query selects `rateLimit { cost remaining limit resetAt }`. */
export const RATE_LIMIT_FIELDS = "rateLimit { cost remaining limit resetAt }";

export async function githubGraphql<T>(
  token: string,
  query: string,
  variables: Record<string, unknown>,
  /** Caller-side cancellation (overall deadline, fan-out abort). */
  signal?: AbortSignal,
): Promise<GraphqlResult<T>> {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `bearer ${token}`,
        "content-type": "application/json",
        "user-agent": "howcommitted",
      },
      body: JSON.stringify({ query, variables }),
      signal: signal ? AbortSignal.any([timeout, signal]) : timeout,
      cache: "no-store",
    });
  } catch (error) {
    return fail(isTimeout(error) ? { kind: "timeout" } : upstream(error));
  }

  if (response.status === 502 || response.status === 504) {
    return fail({ kind: "timeout" });
  }
  if (response.status === 429 || isHeaderRateLimited(response)) {
    return fail({ kind: "rate_limited", resetAt: resetFromHeaders(response) });
  }

  let body: GraphqlBody<T>;
  try {
    body = (await response.json()) as GraphqlBody<T>;
  } catch (error) {
    // The abort signal stays armed while the body streams in.
    if (isTimeout(error)) return fail({ kind: "timeout" });
    return fail({
      kind: "upstream",
      message: `GitHub returned HTTP ${response.status} without JSON`,
    });
  }

  const rateLimit = body.data?.rateLimit ?? null;
  const types = body.errors?.map((e) => e.type) ?? [];

  if (types.includes("RATE_LIMITED")) {
    return {
      ok: false,
      error: { kind: "rate_limited", resetAt: rateLimit?.resetAt ?? null },
      rateLimit,
    };
  }
  if (types.includes("NOT_FOUND")) {
    return { ok: false, error: { kind: "not_found" }, rateLimit };
  }
  if (!response.ok || !body.data) {
    const message =
      body.errors?.[0]?.message ?? `GitHub returned HTTP ${response.status}`;
    return { ok: false, error: { kind: "upstream", message }, rateLimit };
  }
  return { ok: true, data: body.data, rateLimit };
}

function fail<T>(error: GithubError): GraphqlResult<T> {
  return { ok: false, error, rateLimit: null };
}

function upstream(error: unknown): GithubError {
  return {
    kind: "upstream",
    message: error instanceof Error ? error.message : "Network error",
  };
}

function isTimeout(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  );
}

function isHeaderRateLimited(response: Response): boolean {
  return (
    response.status === 403 &&
    (response.headers.get("x-ratelimit-remaining") === "0" ||
      response.headers.has("retry-after"))
  );
}

function resetFromHeaders(response: Response): string | null {
  const reset = Number(response.headers.get("x-ratelimit-reset"));
  if (reset > 0) return new Date(reset * MS_PER_SECOND).toISOString();
  const retryAfter = Number(response.headers.get("retry-after"));
  if (retryAfter > 0) {
    return new Date(Date.now() + retryAfter * MS_PER_SECOND).toISOString();
  }
  return null;
}
