---
id: D-5u7ezf3zgt
title: 명세 브라우저 설계
description: 읽기 전용 브라우저의 구성과 경계, 주요 설계 결정
order: 10
requirements:
  - R-5eehizubwl
  - R-tkl3lrrlpu
  - R-wa3wnknrlt
sources:
  - id: W-dmcvdbs53b
    note: Git 읽기와 오류 처리, 원본 보존
---

## 개요

명세 이력·요구사항·참여자를 연결하는 읽기 전용 브라우저다. React·Astryx로 UI를 구성하고 TanStack Router가 경로·선택·필터를, TanStack Query가 서버 조회 상태를 관리한다. 목록을 대체하는 상세 페이지는 경로 계층(`/features/<S-ID>`, `/contributors/<이메일>`)으로 구분하고, 같은 화면 안의 검색·탭·드로어 선택은 URL 검색 인자에 둔다. 브라우저는 파일이나 Git 명령을 직접 실행하지 않는다.

## 주요 설계 결정과 제한

첫 화면은 제품 개요 대시보드다. 2026-09-18 사용자 요청으로 활동에서 바꿨다. 요구사항과 설계는 같은 이력에서 종류를 구분하고 공통 원문을 중복 저장하지 않는다. 집계 차트는 라이브러리 없이 SVG·ProgressBar로 그린다. 문서의 다이어그램만 mermaid를 번들에 담으며 그 대가는 결정 0008에 있다. 이력은 `.git` 안의 SQLite 색인에 두며(이력 색인 절, 결정 0009), 체크아웃은 저장하지 않고 요청 때 읽는다. 편집·승인 UI와 작업 파일 표시는 범위 밖이다.
