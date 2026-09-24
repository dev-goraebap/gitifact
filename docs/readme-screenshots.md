# README 스크린샷 · 2026-09-20

영문·한국어 README는 `packages/intro/assets/screenshots/`의 같은 JPEG 세 장을 사용한다. 언어별로 이미지를 복제하지 않고 alt 텍스트만 번역한다. 소개 원본은 `packages/intro/en/intro.md`와 `packages/intro/ko/intro.md`다. 브라우저 소개 화면에서는 이미지를 번들 안의 주소로 바꿔 오프라인에서도 표시한다.

| 파일 | 화면 |
| --- | --- |
| `feature-requirements.jpg` | 기능별 요구사항과 설계 연결 |
| `project-instructions.jpg` | AGENTS.md와 작업별 지침 3개가 있는 프로젝트 지침 목록 |
| `activity.jpg` | 결정기록 목록: 커밋마다 결정기록과 그것이 설명하는 문서 변경 |

## 촬영 자료

Fieldnotes는 고객 피드백을 제품 로드맵과 연결하는 가상의 서비스다. 제품·팀·이메일·이력은 촬영용으로 만든 자료이며 실제 프로젝트의 정보를 사용하지 않는다. 이메일은 `example.invalid` 도메인을 쓴다.

로컬 데모 저장소는 `.tmp/readme-showcase/fieldnotes`에 있다. 기능 5개, 요구사항 15개, 설계 5개, 위키 9페이지를 영어로 작성했다. CLI의 `spec save`와 `spec commit`으로 문서와 변경 이유를 저장하고 CLI가 발급한 ID를 사용했다. 데모 작성자의 이메일 오타를 고칠 때만 DEV-03의 미지원 커밋 수정에 따라 임시 저장소의 마지막 커밋을 amend했다.

데모 생성 스크립트와 저장소는 `.tmp/`의 로컬 촬영 자료다. 새 체크아웃에서 빌드할 때는 추적된 이미지 세 장만 필요하다. 다시 촬영할 때는 별도 데모 저장소를 열고 언어를 English로, 화면 모드를 Dark로 선택한다. 화면 데이터를 바꾸거나 합성하지 않고 실제 브라우저를 캡처한다.

최종 캡처는 사용자가 제시한 화면 비율에 맞춰 1368×1242 크기를 사용했다. 사이드바와 하단 GitHub 링크가 보이도록 다크 모드에서 세 화면을 다시 촬영했다. 브라우저가 반환한 JPEG 원본을 재압축하지 않고 저장했다.

## 2026-09-24 프로젝트 지침 화면

위키가 프로젝트 지침으로 바뀌어 `project-wiki.jpg`를 `project-instructions.jpg`로 바꿨다. 원본 데모는 그대로 두고, 사본 `.tmp/readme-showcase/fieldnotes-0.8`을 개발 빌드의 `guide show migrate` 절차로 0.8.0 형식에 옮겼다(전환 커밋과 AGENTS.md 색인 커밋). 위키 폴더 셋이 지침 `architecture`·`handbook`·`product`가 됐다. 촬영은 같은 조건(English, Dark, 1368×1242)으로 Playwright chromium이 반환한 JPEG(품질 90)를 그대로 저장했다. 사이드바의 버전 표시는 촬영 때 빌드 버전인 v0.7.1이다. 이 전환에서 찾은 migrate 지침의 빈틈(고친 위키 README의 처리, 제목 없는 폴더, 설계의 `# 제목` 줄)은 지침에 반영했다. 데모의 README는 그 반영 전에 옮겨 지침이 되지 않았다.

## 2026-09-24 결정기록과 대시보드

변경 이유가 결정기록으로, 활동 메뉴가 "Decision records"로, 제품 개요가 "Dashboard"로 바뀌어 세 장을 모두 다시 찍었다. 사이드바와 필터에 아이콘이 생겨 나머지 두 장도 옛 화면이었다.

데모 `fieldnotes-0.8`은 이전 개발 빌드로 옮긴 것이라 옛 이유 파일 `history.jsonl`이 남아 있었다. 현재 개발 빌드의 CLI로 세 커밋을 더했다. Alex Morgan이 옛 이유 파일을 지웠고, Jamie Chen이 출시 알림을 하루 한 통 요약으로 바꿨으며(요구사항·설계와 결정기록), Sam Rivera가 초대 유효 기간을 72시간으로 줄였다(요구사항·설계와 결정기록). 스크립트는 로컬 촬영 자료다. 브라우저의 이동 경로가 폴더 이름을 쓰므로 `.tmp/readme-showcase/shoot/fieldnotes`로 복제해 찍었다.

촬영 조건은 같다(English, Dark, 1368×1242, Playwright chromium JPEG 품질 90, 재압축 없음). 사이드바의 버전 표시는 빌드 버전인 v0.7.1이다. 촬영 중 0.7 이유가 문서마다 다른 ID로 저장돼 결정기록 목록에 같은 글이 문서 수만큼 반복되는 결함을 찾아 고쳤다(한 커밋 안의 같은 옛 이유는 한 묶음).

## 검증

- 데모 `spec working`: 경고 없음. 기록 후 Git 변경 없음.
- 브라우저 빌드·타입 검사 통과. 기존 큰 청크 크기 경고는 남아 있다.
- 소개 패키지의 README 일치·링크 검사 2개 통과.
- 브라우저 smoke 검사 8개 통과. 이미지 확장자를 실제 형식에 맞춘 뒤 소개 탐색 검사도 다시 통과했다.
- 양쪽 README의 이미지 주소, JPEG 시그니처, 원본과 번들 이미지의 바이트 일치를 확인했다.
