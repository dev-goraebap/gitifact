---
id: W-ognoghkj7k
title: 결정 0001. 위키 통합과 frontmatter
description: 제품 설명과 지침을 위키 하나로 합치고 파일 ID를 frontmatter로 옮긴 결정
---

상태: Superseded by 0010 · 2026-09-18

## 맥락

0.4.x는 제품 설명(`product/PRODUCT.md`, `P-`)과 지침(`guides/`, `G-`)을 두 폴더로 나누고, 파일 ID를 첫 줄 HTML 주석으로 뒀다. 사용자마다 필요한 문서 구성이 달라 고정된 두 폴더가 맞지 않았고, 설계의 참고 문서 목록처럼 구조가 있는 메타를 주석 한 줄에 담기 어려웠다. 정식 버전 전이라 기존 기록의 전환 비용은 감수할 수 있었다.

## 결정

두 폴더를 `.gitifact/wiki/` 하나와 `W-` ID로 합친다. 진입 페이지는 `README.md`다. 파일 단위 메타(ID, 설계의 `sources`)는 YAML frontmatter에 두고, 절 단위 표시(`gitifact-req`, `gitifact-ref`)는 본문 주석으로 남긴다. 저장 규약은 schemaVersion 2이며 1은 이유를 밝히고 거부한다. 옛 첫 줄 주석은 이력 조회를 위해 읽기만 한다.

## 결과

원본이 하나가 되어 브라우저 메뉴와 지침이 단순해지고, GitHub가 frontmatter를 표로 보여 준다. 대가는 형식이 frontmatter와 주석 두 가지로 남는 것과, 0.4.x 프로젝트를 새로 도입해야 하는 것이다. 기각한 안: 기존 `P-`·`G-` ID를 이어 받기(접두어 세 종류가 남음), 절 단위까지 frontmatter로 옮기기(제목과 ID의 대응을 따로 유지해야 하고 조사한 도구 중 선례가 없음), 요구사항 하나를 파일 하나로 쪼개기(기능 단위 읽기를 깸).
