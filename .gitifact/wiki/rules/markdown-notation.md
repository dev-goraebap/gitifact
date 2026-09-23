---
id: W-f7gtcx7hav
title: 문서 표기
description: 문서에 쓸 수 있는 Markdown 표기와 브라우저가 그리는 범위
---

위키·명세·설계 본문에서 쓰는 표기를 정한다. 브라우저가 그리는 것과 에디터·GitHub가 그리는 것이 같아야 하므로, 양쪽이 모두 아는 표기만 쓴다.

## 쓸 수 있는 표기

| 표기 | 쓰임 |
| :--- | :--- |
| 제목·목록·표·인용 | 일반 Markdown 그대로다 |
| 코드 펜스 | 언어 이름을 붙이면 색이 입는다. 모르는 언어는 색 없이 나온다 |
| ` ```mermaid ` 펜스 | 다이어그램으로 그려진다 |
| `> [!NOTE]` 등 다섯 종류 | 알림 상자로 그려진다 |
| 상대 경로 링크·이미지 | 브라우저가 해당 페이지·기능·에셋으로 연결한다 |

원시 HTML은 쓰지 않는다. 브라우저가 실행하지 않으므로 글자 그대로 남는다.

## 다이어그램

종류 고르기와 작성 규칙은 `gitifact guide show writing`의 "다이어그램" 절을 따른다. 아래는 브라우저가 그리는 것을 확인한 예다. 갈라지고 합쳐지는 흐름은 `flowchart`로 그린다.

```mermaid
flowchart LR
  U[사용자] --> A[에이전트]
  A -->|파일 수정| S[".gitifact/spec · wiki"]
  A -->|changes commit| G[(Git)]
  S --> B[브라우저]
  G --> B
```

여러 구성 요소가 차례로 주고받는 요청·응답은 `sequenceDiagram`으로 그린다.

```mermaid
sequenceDiagram
  participant 사용자
  participant 에이전트
  participant CLI
  사용자->>에이전트: 게시물을 지울 수 있게 해주세요
  에이전트->>CLI: docs list
  CLI-->>에이전트: 기능·요구사항 목록
  에이전트->>CLI: docs new requirement
  CLI-->>에이전트: 발급한 R-ID와 파일
```

> [!NOTE]
> 다이어그램을 그리는 코드는 패키지에 함께 담겨 있다. 외부 서비스를 부르지 않으므로 오프라인에서도 같은 그림이 나온다.

## 알림

다섯 종류의 쓰는 자리와 파일당 개수 기준은 `gitifact guide show writing`의 "인용과 Alert" 절에 있다. 브라우저에서는 이렇게 보인다(`NOTE`는 위 다이어그램 절의 상자).

> [!TIP]
> 작업에 도움이 되는 선택적 요령.

> [!IMPORTANT]
> 깨면 안 되는 불변 조건, 작업 전에 알아야 할 필수 조건.

> [!WARNING]
> 어기면 보안 문제나 잘못된 동작으로 이어지는 조건.

> [!CAUTION]
> 데이터 손실처럼 되돌리기 어려운 위험.

표지 없는 인용문은 인용 그대로 남는다.

> 인용문은 다른 문서나 사람의 말을 옮길 때 쓴다.

## 제한

문법이 틀린 다이어그램은 그 자리에 원문과 이유가 보이고 나머지 문서는 그대로 열린다. 수식(KaTeX)과 각주는 그리지 않는다. 자세한 구현은 [브라우저 설계](../../spec/browser/design/overview.md)와 [결정 0008](../adr/0008-bundled-diagram-rendering.md)에 있다.
