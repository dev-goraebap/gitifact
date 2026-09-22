---
id: D-vmhb7xlhjb
title: 표시 언어 설계
description: 언어 결정 순서, 메시지 카탈로그, 요청별 언어와 배포 문서
order: 10
requirements:
  - R-eeyxmpd37g
  - R-y6gszx7dg6
  - R-l2cviw6kk7
  - R-lwzfbzmgi4
sources:
  - id: W-dmcvdbs53b
  - id: W-xt2mfa2odx
---

## 개요

표시 언어는 사용자 환경의 선택이다. 프로젝트의 문서 언어나 저장 규약과 분리한다. 기존 패키지별 shared/i18n/<lang> 구조에 영어를 추가하고 ko·en 카탈로그의 키와 치환 이름을 맞춘다.

## 구조와 데이터

브라우저 shared/i18n/language는 useSyncExternalStore로 현재 언어와 선택값을 구독한다. gitifact-language에 system·ko·en을 저장하고 navigator.language와 storage·languagechange 이벤트를 따른다. 문구를 표시하는 컴포넌트는 변경을 구독하며 모듈 로드 시 번역한 값을 고정하지 않는다. Astryx InternationalizationProvider의 locale도 같은 값으로 바꾼다. 언어 변경을 위해 앱을 재마운트하거나 프로젝트 Query 캐시를 비우지 않는다.

CLI는 명령 연결 전에 --lang과 환경의 우선순위로 언어를 정한다. HTTP 요청은 Accept-Language를 AsyncLocalStorage 범위에 넣고 core는 CLI가 주입한 언어 resolver로 같은 요청 언어를 쓴다. core는 환경변수나 Node API를 읽지 않는다. 오류를 포함하는 동시 읽기 Promise는 언어별로 공유하고, 성공한 이력 색인은 언어와 무관하게 재사용한다. 캐시된 저장소 오류는 응답할 때 코드로 다시 표시하고, 실패한 브라우저 조회는 언어 변경 시 다시 읽는다.

## 처리 흐름

브라우저의 소개·시작하기는 packages/intro/<lang> 원문을 번들한다. 패치노트는 언어가 포함된 Query 키와 lang 인자로 요청한다. README.md는 영어 소개, README.ko.md는 한국어 소개, npm README는 영어 시작하기의 사본이며 테스트로 일치를 확인한다.

기존 블록은 --lang 명시값, 블록에 기록된 언어, 현재 CLI 언어 순으로 정한다. 언어 토큰이 없던 블록은 한국어다. 신규 블록과 최초 기본 위키만 CLI 언어로 만든다. 기존 wiki README는 `guide show wiki`의 안내 부분과 다른 언어여도 원문을 유지한다.

## 오류 처리와 검증

미지원 환경 언어는 영어로, 잘못된 --lang 값은 명령 오류로 처리한다. 브라우저 저장소 접근 실패는 현재 탭의 선택을 막지 않는다. 키·치환 값·번들 문서 누락, 동시 HTTP 언어 분리, 블록 갱신과 원문 보존, 화면 전환·새로고침·탭 동기화를 검증한다. 실제 사용 프로젝트의 호환성 검사는 원본을 읽고 임시 복사본에서 실행한다.

## 주요 설계 결정

config.language를 추가하는 이전 구상은 사용자의 브라우저별 설정 요청에 따라 채택하지 않는다. 환경마다 CLI 언어가 달라도 기존 블록 언어를 보존해 반복 업데이트 시 언어가 오가는 문제를 막는다. 공용 번역 패키지나 런타임 번역 서비스는 추가하지 않는다. 언어 선택은 기록 파일이나 JSON 계약을 바꾸지 않으므로 schemaVersion을 올리지 않는다.
