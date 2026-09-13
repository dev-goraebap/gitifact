export class ApiError extends Error {
  constructor(message: string, readonly code: string) { super(message); this.name = 'ApiError'; }
}
export async function requestJson(path: string, options: RequestInit = {}): Promise<{ response: Response; data: unknown }> {
  let response: Response;
  try { response = await fetch(path, { ...options, cache: 'no-store' }); }
  catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new ApiError('로컬 서버에 연결하지 못했습니다. 서버 실행 상태를 확인하세요.', 'NETWORK_ERROR');
  }
  try { return { response, data: await response.json() as unknown }; }
  catch { throw new ApiError('서버 응답 형식을 확인할 수 없습니다. CLI와 브라우저 버전을 확인하세요.', 'INVALID_RESPONSE'); }
}
