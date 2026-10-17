import { describe, expect, it } from "vitest";
import {
  PLACEHOLDER_NAMES,
  placeholderAt,
  placeholderFor,
  STATIC_PLACEHOLDER,
} from "./placeholder";

const names = ["ab", "xyz"];

describe("placeholderAt", () => {
  it("types one letter per tick", () => {
    expect(placeholderAt(0, names, 2)).toBe("a");
    expect(placeholderAt(1, names, 2)).toBe("ab");
  });

  it("holds the finished name, then clears for one tick", () => {
    expect(placeholderAt(2, names, 2)).toBe("ab");
    expect(placeholderAt(3, names, 2)).toBe("ab");
    expect(placeholderAt(4, names, 2)).toBe("");
  });

  it("moves on to the next name", () => {
    expect(placeholderAt(5, names, 2)).toBe("x");
    expect(placeholderAt(7, names, 2)).toBe("xyz");
  });

  it("loops back to the first name", () => {
    // Cycle length: (2 + 2 + 1) + (3 + 2 + 1) = 11
    expect(placeholderAt(11, names, 2)).toBe("a");
    expect(placeholderAt(11 * 40 + 1, names, 2)).toBe("ab");
  });

  it("only ever shows prefixes of the known usernames", () => {
    for (let tick = 0; tick < 200; tick++) {
      const text = placeholderAt(tick);
      expect(
        text === "" || PLACEHOLDER_NAMES.some((name) => name.startsWith(text)),
      ).toBe(true);
    }
  });
});

describe("placeholderFor", () => {
  it("is static when the animation is off (reduced motion, focus)", () => {
    expect(placeholderFor(null)).toBe(STATIC_PLACEHOLDER);
    expect(STATIC_PLACEHOLDER).toBe("torvalds");
  });

  it("follows the cycle while the animation runs", () => {
    expect(placeholderFor(0)).toBe("t");
  });
});
