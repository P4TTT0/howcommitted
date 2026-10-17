import { describe, expect, it } from "vitest";
import { type KeyInput, shortcutFor } from "./shortcuts";

function element(tagName: string, attributes: Record<string, string> = {}) {
  return {
    tagName: tagName.toUpperCase(),
    isContentEditable: attributes.contenteditable === "true",
    getAttribute: (name: string) => attributes[name] ?? null,
  } as unknown as EventTarget;
}

function press(key: string, extra: Partial<KeyInput> = {}) {
  return shortcutFor({
    key,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    defaultPrevented: false,
    target: element("body"),
    ...extra,
  });
}

describe("shortcutFor", () => {
  it("maps the documented keys", () => {
    expect(press(" ")).toBe("toggle");
    expect(press("ArrowLeft")).toBe("prev");
    expect(press("ArrowRight")).toBe("next");
    expect(press("m")).toBe("mute");
    expect(press("M")).toBe("mute");
    expect(press("Escape")).toBe("cancel");
  });

  it("ignores every other key", () => {
    for (const key of ["a", "Enter", "Tab", "ArrowUp", "ArrowDown", "p"]) {
      expect(press(key)).toBeNull();
    }
  });

  it("never fires while typing", () => {
    for (const tag of ["input", "textarea", "select"]) {
      expect(press("m", { target: element(tag) })).toBeNull();
      expect(press("Escape", { target: element(tag) })).toBeNull();
      expect(press("ArrowLeft", { target: element(tag) })).toBeNull();
      expect(press(" ", { target: element(tag) })).toBeNull();
    }
    expect(
      press("m", { target: element("div", { contenteditable: "true" }) }),
    ).toBeNull();
  });

  it("leaves browser and OS shortcuts alone", () => {
    expect(press("ArrowLeft", { altKey: true })).toBeNull();
    expect(press("m", { ctrlKey: true })).toBeNull();
    expect(press("m", { metaKey: true })).toBeNull();
  });

  it("leaves a key alone when something already handled it", () => {
    expect(press("ArrowRight", { defaultPrevented: true })).toBeNull();
  });

  it("does not steal Space from a control that Space activates", () => {
    expect(press(" ", { target: element("button") })).toBeNull();
    expect(press(" ", { target: element("a") })).toBeNull();
    expect(
      press(" ", { target: element("div", { role: "button" }) }),
    ).toBeNull();
    // A focused chart does not use Space.
    expect(press(" ", { target: element("div", { role: "slider" }) })).toBe(
      "toggle",
    );
  });

  it("still lets arrows, M and Escape work from a focused button", () => {
    const target = element("button");
    expect(press("ArrowRight", { target })).toBe("next");
    expect(press("m", { target })).toBe("mute");
    expect(press("Escape", { target })).toBe("cancel");
  });
});
