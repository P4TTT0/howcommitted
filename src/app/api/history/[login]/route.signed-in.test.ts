import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getProfile = vi.hoisted(() => vi.fn());
vi.mock("@/github/profile", () => ({ getProfile }));
vi.mock("@/github/services", () => ({
  getServices: () => ({ deps: { marker: "deps" } }),
}));

import { sessionCookie } from "@/github/session";
import { GET } from "./route";

const TOKEN = "gho_16C7e42F292c6912E7710c838347Ae178B4a";
const SECRET = "h".repeat(40);

const request = (cookie?: string) =>
  new Request("http://localhost/api/history/ada", {
    headers: cookie ? { cookie } : undefined,
  });
const sessionPair = () =>
  (sessionCookie(TOKEN, SECRET).split(";")[0] as string).trim();

const okResult = { status: "login_required", reason: "quota_exhausted" };

beforeEach(() => {
  vi.stubEnv("QUOTA_COOKIE_SECRET", "q".repeat(40));
  vi.stubEnv("AUTH_COOKIE_SECRET", SECRET);
  getProfile.mockReset();
  getProfile.mockResolvedValue(okResult);
});

afterEach(() => vi.unstubAllEnvs());

const optionsOf = () =>
  getProfile.mock.calls[0]?.[3] as {
    userToken: string | null;
    onTokenRejected: () => void;
  };

describe("history route and the sign-in session", () => {
  it("passes the visitor's own token to the pipeline when signed in", async () => {
    await GET(request(sessionPair()), {
      params: Promise.resolve({ login: "ada" }),
    });
    expect(optionsOf().userToken).toBe(TOKEN);
  });

  it("treats a missing, tampered or foreign cookie as anonymous", async () => {
    for (const cookie of [
      undefined,
      "hc_session=v1.tampered",
      `hc_session=${TOKEN}`,
    ]) {
      getProfile.mockClear();
      await GET(request(cookie), { params: Promise.resolve({ login: "ada" }) });
      expect(optionsOf().userToken).toBeNull();
    }
  });

  it("clears the session cookie when GitHub rejects the token", async () => {
    getProfile.mockImplementation(async (...args: unknown[]) => {
      (args[3] as { onTokenRejected: () => void }).onTokenRejected();
      return okResult;
    });
    const response = await GET(request(sessionPair()), {
      params: Promise.resolve({ login: "ada" }),
    });
    const cookies = response.headers.getSetCookie();
    expect(cookies.some((c) => /^hc_session=; .*Max-Age=0/.test(c))).toBe(true);
  });

  it("never echoes the token in the response", async () => {
    const response = await GET(request(sessionPair()), {
      params: Promise.resolve({ login: "ada" }),
    });
    expect(await response.text()).not.toContain(TOKEN);
    expect(JSON.stringify([...response.headers])).not.toContain(TOKEN);
  });
});
