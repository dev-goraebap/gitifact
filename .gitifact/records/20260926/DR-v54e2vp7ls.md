---
id: DR-v54e2vp7ls
title: ".gitifact/.gitattributes 커밋 허용"
docs:
  - D-jxe47zy5fq
---

## 맥락

0.8.1부터 `init`이 `.gitifact/.gitattributes`를 쓰지만 `changes commit`은 `.gitifact` 안에서 문서·결정기록·`config.json`·에셋만 받았다. 사용자 프로젝트에서는 이 파일을 `changes commit`으로 커밋할 수 없었고, 이 저장소도 기본 Git으로 커밋했다(`df5b9da`).

## 결정

`changes commit`이 `.gitifact/.gitattributes` 한 경로를 `config.json`처럼 저장소 자체 파일로 받는다. 거부 문구와 `guide show commit`에 이 파일을 적는다.

## 검토한 대안

- `.gitifact` 안의 모든 `.gitattributes`를 받기(init이 쓰지 않는 파일까지 열어 문서 폴더의 줄바꿈 규칙을 몰래 바꿀 수 있다)
