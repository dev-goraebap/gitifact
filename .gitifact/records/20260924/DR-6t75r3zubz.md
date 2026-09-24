---
id: DR-6t75r3zubz
title: pnpm TypeScript 모노레포 구성
docs:
  - I-zdpwuta64o
---

## 맥락

CLI와 브라우저가 같은 기록 규칙과 데이터 계약을 써야 하지만 실행 환경은 다르다. CLI는 명령 실행, Git·파일 접근, 로컬 HTTP 서버를 맡고 브라우저는 React 앱과 정적 빌드다. 대가는 계약 변경마다 버전을 올리는 비용과, 공통으로 보이는 코드도 경계를 넘기려면 공개 API를 설계해야 하는 것이다.

## 결정

`apps`(실행·배포 단위)와 `packages`(독립된 책임과 공개 API가 있는 코드 단위)로 나눈 pnpm TypeScript 모노레포로 둔다. TypeScript strict·ESM과 단일 lockfile을 쓰고, 검증은 zod 계약·node:test·Playwright로 한다. 의존은 `apps/browser → contracts, intro`, `apps/cli → core, contracts` 방향으로만 두고, 앱끼리 소스를 import하지 않으며 exports로 공개한 진입점만 쓴다. UI 공통 코드는 React 앱이 하나인 동안 브라우저의 `shared/ui`에 둔다.

## 검토한 대안

- 추가 모노레포 도구(빌드 병목이 생기기 전에는 도입하지 않음)
- 빈 계층을 미리 만들기
