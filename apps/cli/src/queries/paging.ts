/** How many items a list shows when the caller does not ask for another size. */
export const PAGE_SIZE = 20;
/** One page of a list: the items shown, how many there are in all, and where the next page starts (null at the end). */
export interface Page<T> { rows: T[]; total: number; next: string | null }
export interface PageRequest { after?: string | undefined; limit?: number | undefined; all?: boolean | undefined }

/**
 * One page of rows already in list order. The cursor is the key of the last item shown, so the next page starts
 * after that item even if items before it came or went. A cursor that is no longer listed answers undefined: the CLI
 * refuses it and the server answers 404, and the list is read again from the start. `all` is every item.
 */
export function pageOf<T>(rows: readonly T[], keyOf: (row: T) => string, request: PageRequest): Page<T> | undefined {
  let start = 0;
  if (request.after !== undefined) {
    const at = rows.findIndex(row => keyOf(row) === request.after);
    if (at < 0) return undefined;
    start = at + 1;
  }
  const size = request.all ? rows.length : request.limit ?? PAGE_SIZE;
  const shown = rows.slice(start, start + size);
  const more = start + shown.length < rows.length && shown.length > 0;
  return { rows: shown, total: rows.length, next: more ? keyOf(shown[shown.length - 1]!) : null };
}
