import { describe, expect, it } from "vitest";
import { makeHistory, makeYear, steadyDays } from "../timeline/historyFixture";
import { failureCopy, interpretHistory } from "./historyResult";

const history = makeHistory("ada", [makeYear(2024, steadyDays(2024, 2))]);

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

  it("maps each API status to a failure", () => {
    expect(interpretHistory(404, null).kind).toBe("not_found");
    expect(interpretHistory(401, null).kind).toBe("login_required");
    expect(interpretHistory(400, null).kind).toBe("invalid");
    expect(interpretHistory(429, null).kind).toBe("breather");
    expect(interpretHistory(503, null).kind).toBe("breather");
    expect(interpretHistory(502, null).kind).toBe("upstream");
    expect(interpretHistory(504, null).kind).toBe("upstream");
    expect(interpretHistory(500, null).kind).toBe("server");
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

  it("offers a retry when waiting can help", () => {
    expect(failureCopy({ kind: "breather" }, "ada").retry).toBe(true);
    expect(failureCopy({ kind: "upstream" }, "ada").retry).toBe(true);
    expect(failureCopy({ kind: "server" }, "ada").retry).toBe(true);
  });
});
