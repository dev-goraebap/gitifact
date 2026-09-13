const messages = {
  GIT_NOT_FOUND: 'Git 실행 파일을 찾지 못했습니다.',
  GIT_CONTEXT_OVERRIDE: '현재 checkout과 다른 Git 컨텍스트를 지정하는 환경변수가 있습니다.',
  NOT_A_REPOSITORY: '현재 위치가 Git 작업 폴더에 속하지 않습니다.',
  UNSUPPORTED_REPOSITORY: 'bare 저장소 또는 Git 관리 디렉터리에서는 조회할 수 없습니다.',
  GIT_UNSUPPORTED: '필요한 Git 옵션 또는 object format을 지원하지 않습니다.',
  GIT_FAILED: 'Git 조회에 실패했습니다. 저장소 접근 권한과 Git 상태를 확인하세요.',
  INVALID_GIT_OUTPUT: 'Git 상태 출력이 지원하는 형식과 일치하지 않습니다.',
  UNSUPPORTED_PATH_ENCODING: 'Git 경로를 UTF-8로 손실 없이 표현할 수 없습니다.',
  REPOSITORY_CHANGED: '조회 중 저장소 상태가 변경됐습니다. 잠시 후 다시 조회하세요.',
  READ_LIMIT_EXCEEDED: 'Git 조회의 시간 또는 출력 크기 제한을 초과했습니다.',
} as const;
export type RepositoryReadErrorCode = keyof typeof messages;
export class RepositoryReadError extends Error {
  readonly code: RepositoryReadErrorCode;
  constructor(code: RepositoryReadErrorCode) {
    super(messages[code]);
    this.name = 'RepositoryReadError';
    this.code = code;
  }
}
