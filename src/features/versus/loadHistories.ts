import type { History } from "@/domain/history";
import {
  type HistoryFailure,
  type HistoryOutcome,
  interpretHistory,
} from "@/features/experience/historyResult";

export type LoadedHistories =
  | { kind: "ok"; histories: History[] }
  | { kind: "failed"; login: string; failure: HistoryFailure };

export async function fetchHistory(
  login: string,
  fetcher: typeof fetch = fetch,
): Promise<HistoryOutcome> {
  try {
    const response = await fetcher(`/api/history/${encodeURIComponent(login)}`);
    const body: unknown = await response.json().catch(() => null);
    return interpretHistory(
      response.status,
      body,
      response.headers.get("retry-after"),
    );
  } catch {
    return { kind: "network" };
  }
}

/**
 * Loads each developer's history one after another, in order. Anonymous cold
 * runs are scarce, so it stops at the first failure (`login_required`
 * included) instead of spending more. `onStart` reports which developer is
 * being read.
 */
export async function loadHistories(
  logins: readonly string[],
  fetchOne: (login: string) => Promise<HistoryOutcome> = fetchHistory,
  onStart: (login: string, index: number) => void = () => {},
): Promise<LoadedHistories> {
  const histories: History[] = [];
  for (const [index, login] of logins.entries()) {
    onStart(login, index);
    const outcome = await fetchOne(login);
    if (outcome.kind !== "ok") {
      return { kind: "failed", login, failure: outcome };
    }
    histories.push(outcome.history);
  }
  return { kind: "ok", histories };
}
