import { describe, expect, it } from "vitest";
import { loginTypography } from "./Poster";

describe("loginTypography", () => {
  it("uses big fluid display type for short logins", () => {
    const short = loginTypography("ada");
    expect(short.className).toContain("font-display");
    expect(short.fontSize).toBe("min(22vw, 24dvh)");
    expect(loginTypography("torvalds").fontSize).toBe("min(17vw, 24dvh)");
  });

  it("shrinks in named steps as the login grows", () => {
    expect(loginTypography("x".repeat(11)).fontSize).toBe("min(12vw, 24dvh)");
    expect(loginTypography("x".repeat(12)).className).toContain("font-mono");
  });

  it("drops to Martian Mono instead of tiny display type", () => {
    const long = loginTypography("a-very-long-github-login-name");
    expect(long.className).toContain("font-mono");
    expect(long.className).not.toContain("font-display");
    expect(long.fontSize).toBeUndefined();
  });
});
