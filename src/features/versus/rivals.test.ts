import { describe, expect, it } from "vitest";
import { addRival, removeRival, rivalsFor } from "./rivals";

describe("addRival", () => {
  it("adds in order", () => {
    expect(addRival("ada", [], "grace")).toEqual({
      kind: "added",
      rivals: ["grace"],
    });
  });

  it("rejects the main developer and repeats, case-insensitively", () => {
    expect(addRival("ada", [], "ADA")).toEqual({ kind: "duplicate" });
    expect(addRival("ada", ["grace"], "Grace")).toEqual({ kind: "duplicate" });
  });

  it("stops at five developers in total", () => {
    expect(addRival("a", ["b", "c", "d"], "e").kind).toBe("added");
    expect(addRival("a", ["b", "c", "d", "e"], "f")).toEqual({ kind: "full" });
  });
});

describe("removeRival and rivalsFor", () => {
  it("removes by login, ignoring case", () => {
    expect(removeRival(["grace", "linus"], "GRACE")).toEqual(["linus"]);
  });

  it("drops a rival equal to the main developer", () => {
    expect(rivalsFor("Ada", ["ada", "grace"])).toEqual(["grace"]);
  });
});
