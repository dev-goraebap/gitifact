export type ProductSearch = { q?: string | undefined; feature?: string | undefined; selected?: string | undefined; author?: string | undefined; kind?: string | undefined };
export function validateProductSearch(input: Record<string, unknown>): ProductSearch {
  const out: ProductSearch = {};
  for (const key of ['q','feature','selected','author','kind'] as const) if (typeof input[key] === 'string' && input[key].length <= 240) out[key] = input[key];
  return out;
}
