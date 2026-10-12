---
id: DR-qzop3uw6lj
title: 프로젝트 실행기로 Gitifact 실행
docs:
  - R-swysucdphy
  - D-qocsgecvk2
  - D-3nu5nrwhee
  - D-crtw43mrkq
  - D-rqtjehka7u
  - D-yrow77r5pf
  - R-b2q2g4sgsd
  - R-cj525dk5vt
  - R-cr5rajcs4a
  - R-lpwtvv6ldp
  - R-m7fyerzqti
---

## 맥락

전역 설치가 마찰을 반복해서 만들었다. 자동 모드의 설치 차단, PowerShell의 npm.ps1 실행 정책이 있었고, 전역에는 한 버전만 있어 한 프로젝트를 위해 깐 시험판이 다른 프로젝트까지 바꿨다. 프로젝트에만 npm으로 설치하려 하자 package.json이 없는 프로젝트에서 npm이 홈 폴더에 설치했다. 사용자는 프로젝트에 AGENTS.md, .gitifact, 실행기만 두고 본체는 사용자 폴더에 두는 구조를 원했다.

## 결정

init과 update가 .gitifact/bin/cli.mjs를 쓰고, 에이전트는 node .gitifact/bin/cli.mjs로 실행한다. 실행기는 config의 cli 버전을 사용자 캐시에 한 번 받고(sha512 무결성 확인, GITIFACT_PACKAGE로 로컬 패키지) 그 버전을 실행한다. 업데이트는 npx --yes gitifact@<새 버전> update 한 번이다. 전역 설치는 선택으로 남긴다.

## 검토한 대안

- 셸 스크립트와 cli.cmd 실행기(Windows Git이 실행 권한을 잃고, PowerShell이 확장자 없는 파일을 잘못 연다)
- 실행기가 매번 npx로 실행(호출마다 npx가 패키지를 찾는 시간이 붙는다)
- 프로젝트 devDependency 설치(package.json이 없는 프로젝트에 만들어야 하고, 없으면 npm이 상위 폴더에 설치한다)
- CLI를 Rust 단일 실행 파일로 다시 작성(OS별 빌드와 서명을 떠안고, 기존 TypeScript를 다시 짜야 한다)
