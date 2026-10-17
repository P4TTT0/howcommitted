import { describe, expect, it } from "vitest";
import {
  makeHistory,
  makeYear,
  steadyDays,
} from "@/test-support/historyFixture";
import { failureCopy, interpretHistory } from "./historyResult";

const history = makeHistory("ada", [makeYear(2024, steadyDays(2024, 2))]);
const wrap = (value: unknown) => ({ source: "cache", history: value });

describe("interpretHistory", () => {
  it("reads a successful payload", () => {
    const outcome = interpretHistory(200, {
      source: "cache",
      reposTruncated: true,
      history,
    });
    expect(outcome).toEqual({ kind: "ok", history, reposTruncated: true });
  });

  it("treats a malformed success body as a server problem", () => {
    expect(interpretHistory(200, null).kind).toBe("server");
    expect(interpretHistory(200, { history: { years: [] } }).kind).toBe(
      "server",
    );
  });

  it("rejects payloads whose years the scene could not read", () => {
    const bad = [
      { ...history, years: [{ year: 2024 }] },
      {
        ...history,
        years: [{ ...history.years[0], dailyContributions: [{ date: 1 }] }],
      },
      { ...history, years: [{ ...history.years[0], totalContributions: "x" }] },
      { ...history, totalContributions: undefined },
      {
        ...history,
        years: [{ ...history.years[0], totals: { commits: "many" } }],
      },
      { ...history, yearBlocks: [{ year: 2024, commits: 5 }] },
      { ...history, totals: {} },
      { ...history, user: { login: "ada" } },
    ];
    for (const value of bad) {
      expect(interpretHistory(200, wrap(value)).kind).toBe("server");
    }
  });

  it("maps each API status to a failure", () => {
    expect(interpretHistory(404, null).kind).toBe("not_found");
    expect(interpretHistory(401, null).kind).toBe("login_required");
    expect(interpretHistory(400, null).kind).toBe("invalid");
    expect(interpretHistory(502, null).kind).toBe("upstream");
    expect(interpretHistory(504, null).kind).toBe("upstream");
    expect(interpretHistory(500, null).kind).toBe("server");
  });

  it("blames GitHub only when GitHub is the cause", () => {
    expect(interpretHistory(429, null).kind).toBe("breather");
    const circuit = { error: { code: "degraded", reason: "circuit_open" } };
    expect(interpretHistory(503, circuit).kind).toBe("breather");
    const busy = { error: { code: "degraded", reason: "busy" } };
    expect(interpretHistory(503, busy).kind).toBe("busy");
    const store = { error: { code: "degraded", reason: "store_down" } };
    expect(interpretHistory(503, store).kind).toBe("busy");
  });

  it("keeps Retry-After for the message", () => {
    expect(interpretHistory(429, null, "180")).toEqual({
      kind: "breather",
      retryAfterSeconds: 180,
    });
  });
});

describe("failureCopy", () => {
  it("is honest about sign-in not existing yet", () => {
    expect(failureCopy({ kind: "login_required" }, "ada")).toEqual({
      message: "Free runs used for today. Sign in with GitHub is coming soon.",
      retry: false,
    });
  });

  it("names the missing user and does not offer a retry", () => {
    expect(failureCopy({ kind: "not_found" }, "ghost")).toEqual({
      message: "No GitHub user named @ghost",
      retry: false,
    });
  });

  it("words waits in minutes and keeps GitHub out of our own limits", () => {
    expect(
      failureCopy({ kind: "breather", retryAfterSeconds: null }, "ada").message,
    ).toBe("GitHub needs a breather. Try again in a minute.");
    expect(
      failureCopy({ kind: "busy", retryAfterSeconds: 300 }, "ada").message,
    ).toBe("Too many requests right now. Try again in 5 minutes.");
    expect(failureCopy({ kind: "network" }, "ada").message).toBe(
      "Could not reach Committed. Check your connection.",
    );
  });

  it("offers a retry when waiting can help", () => {
    for (const kind of ["upstream", "server", "network"] as const) {
      expect(failureCopy({ kind }, "ada").retry).toBe(true);
    }
    expect(
      failureCopy({ kind: "breather", retryAfterSeconds: null }, "ada").retry,
    ).toBe(true);
  });
});
