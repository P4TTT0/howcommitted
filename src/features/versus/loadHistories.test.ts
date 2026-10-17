import { describe, expect, it, vi } from "vitest";
import type { History } from "@/domain/history";
import type { HistoryOutcome } from "@/features/experience/historyResult";
import { loadHistories } from "./loadHistories";

const history = (login: string) => ({ user: { login } }) as unknown as History;
const ok = (login: string): HistoryOutcome => ({
  kind: "ok",
  history: history(login),
  reposTruncated: false,
});

describe("loadHistories", () => {
  it("loads every developer sequentially, in order", async () => {
    const order: string[] = [];
    const result = await loadHistories(["a", "b", "c"], async (login) => {
      order.push(`start ${login}`);
      await Promise.resolve();
      order.push(`end ${login}`);
      return ok(login);
    });
    expect(result.kind).toBe("ok");
    expect(order).toEqual([
      "start a",
      "end a",
      "start b",
      "end b",
      "start c",
      "end c",
    ]);
  });

  it("stops at the first failure and never requests the rest", async () => {
    const fetchOne = vi.fn(
      async (login: string): Promise<HistoryOutcome> =>
        login === "b" ? { kind: "login_required" } : ok(login),
    );
    const result = await loadHistories(["a", "b", "c"], fetchOne);
    expect(result).toEqual({
      kind: "failed",
      login: "b",
      failure: { kind: "login_required" },
    });
    expect(fetchOne).toHaveBeenCalledTimes(2);
  });

  it("reports which developer is being read", async () => {
    const seen: [string, number][] = [];
    await loadHistories(
      ["a", "b"],
      async (login) => ok(login),
      (login, index) => seen.push([login, index]),
    );
    expect(seen).toEqual([
      ["a", 0],
      ["b", 1],
    ]);
  });
});
