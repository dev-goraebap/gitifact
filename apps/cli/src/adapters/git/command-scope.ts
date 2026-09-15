import { AsyncLocalStorage } from 'node:async_hooks';

// Per-command cache for values that cannot change meaningfully while one CLI command runs, such as the
// repository location. Never cache HEAD, index or file state here: those are rechecked at each safety point.
const storage = new AsyncLocalStorage<Map<string, Promise<unknown>>>();

export const withCommandScope = <T>(run: () => Promise<T>) => storage.run(new Map(), run);

export function commandScoped<T>(key: string, load: () => Promise<T>): Promise<T> {
  const cache = storage.getStore();
  if (!cache) return load();
  let value = cache.get(key) as Promise<T> | undefined;
  if (!value) {
    value = load(); cache.set(key, value);
    value.catch(() => cache.delete(key));
  }
  return value;
}
