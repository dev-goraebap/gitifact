export type RecordSearch = { sort?: string | undefined; design?: string | undefined; tab?: string | undefined; document?: string | undefined; q?: string | undefined; target?: string | undefined; selected?: string | undefined; author?: string | undefined; record?: string | undefined; view?: string | undefined; dir?: string | undefined };
/** How a screen writes its search: a new value, replacing the history entry while typing. */
export type ChangeSearch = (s: RecordSearch, replace?: boolean) => void;
export function validateRecordSearch(input: Record<string, unknown>): RecordSearch {
  const out: RecordSearch = {};
  for (const key of ['tab','document','q','target','selected','author','record','view','sort','design','dir'] as const) if (typeof input[key] === 'string' && input[key].length <= 240) out[key] = input[key];
  return out;
}
