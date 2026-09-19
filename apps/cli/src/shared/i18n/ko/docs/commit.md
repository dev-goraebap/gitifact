# 커밋 시점의 최종 변경

자동 기록은 커밋 권한이 아니다. 사용자 커밋 요청 또는 명시적 프로젝트 정책이 있을 때 실행한다. 정책이 없다는 이유로 자동 커밋하지 않으며 이미 부여된 권한은 다시 묻지 않는다. 푸시는 별도 권한을 따른다.

## 절차

1. 실제 diff와 관련 테스트를 확인한다. 필요하면 `spec changes`로 HEAD 대비 최종 명세 차이와 pendingReasons를 읽는다.
2. 아래 입력을 `spec working` 또는 `spec changes` 결과의 `inputs.commit` 경로에 UTF-8 JSON으로 쓰고 `spec commit --file <그 경로>`를 실행한다. 커밋이 성공하면 CLI가 입력 파일을 지운다. 범위나 이유 누락을 먼저 보려면 `--dry-run`을 붙인다. dry-run은 파일을 쓰거나 커밋하지 않는다.
3. 성공 결과와 실제 Git 상태를 확인하고, 반환된 withoutReason이 있으면 이유 누락으로 보고한다.

```json
{
  "reasons": [{ "requirements": ["실제 R-ID"], "reason": "대화·결정에서 확인한 변경 이유" }],
  "paths": [".gitifact/spec/posts/requirements.md", ".gitifact/spec/posts/history.jsonl", "src/posts.ts", "test/posts.test.ts"],
  "message": "프로젝트 정책에 맞는 메시지",
  "authorization": { "basis": "user-request", "evidence": "실제 커밋 요청과 작업 범위" }
}
```

basis는 user-request 또는 project-policy다. 예시 경로와 근거를 그대로 복사하지 않는다. 추가 정책은 policyFiles, 코드만 커밋할 때의 연결은 requirements 배열에 실제 R-ID로 전달한다. changes를 보고 이유를 썼다면 그 expected를 함께 넘겨 그사이의 명세 변경을 거부할 수 있다. CLI는 자연어 권한의 진위를 판정하지 않는다.

## 입력 규칙

- reasons는 이번에 남길 **전체 미커밋 이유 목록**이므로 여전히 유효한 pendingReasons도 포함한다. 생략하면 이미 준비된 미커밋 이유를 그대로 유지한다. 모르는 이유는 꾸며내지 않는다. 이유가 없어도 커밋은 진행되며 withoutReason으로 표시된다.
- 위키 페이지의 변경 이유는 `{requirements: [], documents: [실제 W-ID], reason: 실제 이유}`로 전달한다. 이유는 `.gitifact/wiki/history.jsonl`에 기록되므로 바뀐 페이지와 그 파일을 paths에 포함한다.
- 설계 변경 이유는 `{requirements: [], designs: [실제 S-ID], reason: 실제 이유}`로 전달한다. 요구사항과 같은 이유이면 두 배열을 함께 지정한다. 변경된 design.md와 history.jsonl을 paths에 포함한다. 설계만 바뀌면 요구사항 변경이나 완료를 만들지 않는다.
- paths에는 변경한 명세와 그 history.jsonl, 관련 코드·테스트를 담는다. 문서가 참조하는 새 에셋(`.gitifact/assets/…`)도 함께 담는다. 명세 이동이면 양쪽 명세를 포함한다. 기록할 이유가 없는 history.jsonl은 건너뛴다. 미커밋 명세·이유 전체가 선택돼야 하므로 서로 무관한 작업이 섞였다면 강제 포함하지 않고 제한을 알린다.
- 실행 전에는 staging하지 않는다. 기존 staging이나 intent-to-add가 있으면 보존하고 보류한다.
- 수정 후 원복돼 최종 차이가 없으면 새 이유도 없다. 커밋된 history.jsonl을 덮어쓰지 않는다.
- history에는 이유와 요구사항·설계·페이지 연결만 두며 원문 before/after·작성자·시각을 복제하지 않는다. 과거 명세는 `spec read --ref`, 변경은 `spec diff --from --to`로 Git 커밋에서 읽는다. Git 작성자를 사용자 요청·승인의 증거로 취급하지 않는다.
- 훅 등으로 커밋이 거부되고 HEAD가 그대로면 이번에 쓴 이유 파일과 index는 실행 전으로 돌아간다. 원인을 고친 뒤 같은 입력으로 다시 실행한다. 실패 후 훅·서명을 끄지 않는다. HEAD가 바뀐 불확실한 실행은 재시도하지 않고 복구 자료를 확인한다. 잠금이나 index 백업을 임의 삭제하거나 커밋을 reset하지 않는다.

커밋 참조는 구현 완료 선언이 아니다. 실제 테스트 결과와 남은 제한을 별도로 알린다.

## 무엇을 한 커밋에 담는가

기본은 관련 명세·이유·소스·테스트를 같은 커밋에 담는 것이다. 분리 정책이면 명세와 이유를 먼저 커밋하고 코드·테스트 커밋에서 실제 R-ID를 참조한다. 기존 사용자 변경이나 staging을 지우거나 무관한 변경까지 포함하지 않는다.

## 메시지

프로젝트의 커밋 메시지 규약을 따른다. 규약이 없으면 첫 줄에 무엇을 바꿨는지, 본문에 왜 바꿨는지를 짧게 쓴다. 요구사항·설계·페이지 연결 트레일러는 CLI가 붙이므로 메시지에 직접 쓰지 않는다.

## 이유 쓰기

이유는 대화와 결정에서 확인한 사실만 적는다. 기각한 대안이 이후 작업에 영향을 주면 함께 적는다. 커밋 참조를 구현 완료로 보고하지 않고, 실제 실행한 검증과 남은 제한을 따로 알린다.
