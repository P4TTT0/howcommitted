import "server-only";

/**
 * Maps items with at most `limit` calls in flight. Results keep input order.
 * Once `shouldStop` returns true no new item is started; items that never
 * started are absent from the result.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
  shouldStop: () => boolean = () => false,
): Promise<R[]> {
  const results: (R | undefined)[] = new Array(items.length);
  const started: boolean[] = new Array(items.length).fill(false);
  let next = 0;

  async function worker(): Promise<void> {
    while (next < items.length && !shouldStop()) {
      const index = next++;
      started[index] = true;
      results[index] = await fn(items[index] as T);
    }
  }

  const workers = Array.from(
    { length: Math.min(Math.max(limit, 1), items.length) },
    worker,
  );
  await Promise.all(workers);
  return results.filter((_, index) => started[index]) as R[];
}
