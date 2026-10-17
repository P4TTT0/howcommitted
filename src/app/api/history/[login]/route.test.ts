import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as getPreview } from "../../user/[login]/route";
import { GET } from "./route";

const call = (handler: typeof GET, login: string) =>
  handler(new Request(`http://localhost/api/${login}`), {
    params: Promise.resolve({ login }),
  });

afterEach(() => vi.restoreAllMocks());

describe("api routes without credentials", () => {
  it("rejects invalid logins before touching any service", async () => {
    expect((await call(GET, "-bad-")).status).toBe(400);
    expect((await call(getPreview, "a/b")).status).toBe(400);
  });

  it("fails with a clear configuration error only when a service is needed", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    const response = await call(GET, "torvalds");
    expect(response.status).toBe(500);
    expect(
      ((await response.json()) as { error: { code: string } }).error.code,
    ).toBe("server_misconfigured");
    vi.unstubAllEnvs();
  });

  it("rejects a short cookie secret with a configuration error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
    vi.stubEnv("QUOTA_COOKIE_SECRET", "too-short");
    const response = await call(GET, "torvalds");
    expect(response.status).toBe(500);
    expect(console.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("at least 32 characters"),
      }),
    );
    vi.unstubAllEnvs();
  });
});
