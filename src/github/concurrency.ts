import "server-only";

/** Maps items with at most `limit` calls in flight. Results keep input order. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index] as T);
    }
  }

  const workers = Array.from(
    { length: Math.min(Math.max(limit, 1), items.length) },
    worker,
  );
  await Promise.all(workers);
  return results;
}
