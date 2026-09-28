---
id: DR-4kzcepxucn
title: 유즈케이스 방식의 설정·옵션·경고·표시
docs:
  - R-hldv5qv3zr
  - D-rqtjehka7u
  - D-3nu5nrwhee
  - D-4kgfn4hrs6
  - D-j5ixcrj4g2
  - D-y2fgchwma5
---

## 맥락

유즈케이스 방식을 구현하며 프로젝트 기본값의 자리, 파일 하나만 다르게 만드는 법, 키를 빠뜨렸을 때, 브라우저 표시를 정해야 했다. 선테스트에서 키 없이 쓴 유즈케이스 요구사항은 기본 형식 검사를 모두 통과해, 키를 빠뜨리면 아무 검사도 받지 않았다.

## 결정

config `requirementStyle`을 프로젝트가 직접 쓰고 init·update는 손대지 않는다. `specs new --style usecase|default`가 config를 덮어쓴다. config가 usecase면 style 없는 바뀐 요구사항을 REQUIREMENT_STYLE_MISSING으로 알리고, 기본 형식으로 둘 것은 `style: default`를 적는다. 브라우저는 본문을 원문대로 그리고 번호 줄에 표지만 붙인다. 이력 비교가 style을 보도록 계약과 캐시 형식을 올린다.

## 검토한 대안

- init --requirement-style 옵션(도입마다 묻는 절차가 생긴다)
- init이 기본값을 늘 기록(쓰지 않는 프로젝트의 config도 바뀐다)
- --style 없이 config만(섞어 쓰면 손으로 고친다)
- 키 누락 경고 없음(빠뜨려도 검사를 받지 않는다)
- 절 제목 이름표·경로 칩, 흐름 구조로 그리기(본문을 읽어야 한다)
