export type ProductSearch = { sort?: string | undefined; design?: string | undefined; tab?: string | undefined; document?: string | undefined; q?: string | undefined; feature?: string | undefined; selected?: string | undefined; author?: string | undefined; kind?: string | undefined; folder?: string | undefined; view?: string | undefined };
export function validateProductSearch(input: Record<string, unknown>): ProductSearch {
  const out: ProductSearch = {};
  for (const key of ['tab','document','q','feature','selected','author','kind','folder','view','sort','design'] as const) if (typeof input[key] === 'string' && input[key].length <= 240) out[key] = input[key];
  return out;
}
