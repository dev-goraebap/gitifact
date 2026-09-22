export type ProductSearch = { sort?: string | undefined; design?: string | undefined; tab?: string | undefined; document?: string | undefined; q?: string | undefined; feature?: string | undefined; selected?: string | undefined; author?: string | undefined; kind?: string | undefined; folder?: string | undefined; view?: string | undefined; page?: number | undefined; dir?: string | undefined };
export type ProductProps = {view:'history'|'features'|'contributors'|'product'|'wiki';featureId?:string|undefined;email?:string|undefined;documentId?:string|undefined;search:ProductSearch;change:(s:ProductSearch,replace?:boolean)=>void};
export function validateProductSearch(input: Record<string, unknown>): ProductSearch {
  const out: ProductSearch = {};
  for (const key of ['tab','document','q','feature','selected','author','kind','folder','view','sort','design','dir'] as const) if (typeof input[key] === 'string' && input[key].length <= 240) out[key] = input[key];
  // The page is a number so the address reads `?page=2` rather than the quoted string a text value serializes to.
  const page = typeof input.page === 'number' ? input.page : typeof input.page === 'string' ? Number(input.page) : NaN;
  if (Number.isInteger(page) && page > 1) out.page = page;
  return out;
}
