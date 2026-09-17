import { t } from '../i18n';

export class ApiError extends Error {
  constructor(message: string, readonly code: string) { super(message); this.name = 'ApiError'; }
}
export async function requestJson(path: string, options: RequestInit = {}): Promise<{ response: Response; data: unknown }> {
  let response: Response;
  try { response = await fetch(path, { ...options, cache: 'no-store' }); }
  catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new ApiError(t('api.networkError'), 'NETWORK_ERROR');
  }
  try { return { response, data: await response.json() as unknown }; }
  catch { throw new ApiError(t('api.unreadableResponse'), 'INVALID_RESPONSE'); }
}
