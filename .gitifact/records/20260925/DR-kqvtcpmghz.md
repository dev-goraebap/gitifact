---
id: DR-kqvtcpmghz
title: .gitifact/.gitattributes의 LF 고정
docs:
  - R-lpwtvv6ldp
  - D-rqtjehka7u
  - D-qocsgecvk2
  - D-yrow77r5pf
---

## 맥락

Windows에서 `core.autocrlf`가 켜져 있으면 Git에 든 문서와 작업 폴더 파일의 줄바꿈이 달라질 수 있다. 그러면 Git에서 읽은 원문과 실제 파일이 어긋나고, Mac과 Windows 사용자가 함께 쓰면 줄바꿈만 바뀐 가짜 변경이 이력과 비교 화면에 섞인다. 이 저장소는 루트 `.gitattributes`로 LF를 고정해 문제가 없지만 `init`은 사용자 프로젝트에 아무것도 두지 않았다.

## 결정

`init`이 `.gitifact/.gitattributes`에 `* text=auto eol=lf`를 쓴다. 이 파일은 `.gitifact` 아래에만 적용되므로 사용자의 루트 `.gitattributes`는 건드리지 않는다. 이미 있으면 덮어쓰지 않는다. 이미 CRLF로 커밋된 문서는 줄바꿈만 바뀐 변경으로 보이므로, 한 번 커밋해 정리하도록 결과에서 안내한다. `git add --renormalize`는 staging을 남겨 `changes commit`이 거부하므로 안내하지 않는다.

## 검토한 대안

- 루트 `.gitattributes`에 쓰기(사용자 파일을 고치고 `.gitifact` 밖 파일까지 바꿈)
- 아무것도 두지 않기(Git에서 읽은 원문과 파일이 다를 수 있고 가짜 변경이 남음)
