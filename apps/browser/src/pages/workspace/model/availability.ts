const reasons: Record<string, string> = {
  'not-initialized': '이 프로젝트에는 아직 Tryce가 설정되지 않았습니다.',
  'notes-not-enabled': '판단 기록이 활성화되지 않은 프로젝트입니다.',
  'configuration-unavailable': '프로젝트 설정을 읽지 못해 이 자료를 확인할 수 없습니다.',
  'configuration-changed': '조회 중 프로젝트 설정이 바뀌었습니다. 새로 읽기를 시도하세요.',
  'legacy-format': '현재 프로젝트 형식에서는 요구사항 조회를 제공하지 않습니다.',
};

export function availabilityMessage(reason: string) {
  return reasons[reason] ?? reason;
}
