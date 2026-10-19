import { describe, expect, it } from "vitest";
import { routeLogins } from "./routeLogins";

describe("routeLogins", () => {
  it("plays one login solo", () => {
    expect(routeLogins(["ada"])).toEqual(["ada"]);
  });

  it("plays two to five logins as versus", () => {
    expect(routeLogins(["ada", "grace"])).toEqual(["ada", "grace"]);
  });

  it("is not found for malformed paths", () => {
    expect(routeLogins([])).toBeNull();
    expect(routeLogins(["ada", "lab"])).toBeNull();
  });
});
