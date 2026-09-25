---
id: DR-fkmdvkhiti
title: 지침 목록의 딸린 파일 기본 표시
docs:
  - R-qrny2tacwz
  - D-lapfibde2z
  - D-r4umcdt4c6
---

## 맥락

`instructions list`는 지침마다 딸린 파일 수만 보인다. 에이전트는 지침 `index.md`를 열기 전에는 어떤 참고 파일이 있는지 모르고, 작업에 맞는 파일을 고르려면 폴더를 뒤지거나 파일을 모두 열어야 한다. 참고 파일에 제목과 설명이 생기므로(DR-qrhkj2bo7j), 목록이 그것을 보이면 필요한 파일만 고를 수 있다.

## 결정

`instructions list`는 따로 요청하지 않아도 지침 줄 아래에 딸린 파일마다 경로·제목·설명을 들여 쓴다. JSON의 `files`는 파일 수 대신 `{path, size, title?, description?}` 목록이다. `instructions show`도 파일 목록에 제목과 설명을 붙인다. 목록이 길면 `--q`·`--fields`로 줄인다.

## 검토한 대안

- 파일 수만 보이기(에이전트가 무엇을 열지 모른다)
