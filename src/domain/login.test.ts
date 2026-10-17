import { describe, expect, it } from "vitest";
import { isReservedLogin, isValidLogin } from "./login";

describe("isValidLogin", () => {
  it.each(["torvalds", "a", "Ada-Lovelace", "a1-b2", "x".repeat(39)])(
    "accepts %s",
    (login) => {
      expect(isValidLogin(login)).toBe(true);
    },
  );

  it.each([
    "",
    "-ada",
    "ada-",
    "a--b",
    "a_b",
    "a b",
    "a/b",
    "ünï",
    "x".repeat(40),
    "ada\n",
  ])("rejects %j", (login) => {
    expect(isValidLogin(login)).toBe(false);
  });
});

describe("isReservedLogin", () => {
  it("flags logins that collide with app routes, in any case", () => {
    expect(isReservedLogin("lab")).toBe(true);
    expect(isReservedLogin("API")).toBe(true);
    expect(isReservedLogin("torvalds")).toBe(false);
  });
});
