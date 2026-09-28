---
id: DR-qgjduifysd
title: 선택하는 유즈케이스 방식 요구사항
docs:
  - D-m7r675lhb3
  - D-y2fgchwma5
  - R-3ngq5qsdl6
  - R-5eehizubwl
  - R-7fev4w3qb3
  - R-7seqwcdwlq
  - R-aplhjskqow
  - R-b2q2g4sgsd
  - R-cj525dk5vt
  - R-cr5rajcs4a
  - R-dbet7z7kpa
  - R-droz5whebf
  - R-dzowfm436d
  - R-ecmf4ddygu
  - R-eeyxmpd37g
  - R-errzmn5edh
  - R-fqlesmxflt
  - R-fypnjx6dju
  - R-hbz77tj5kc
  - R-hcwqzzv3et
  - R-hjteu77gki
  - R-hldv5qv3zr
  - R-hlndpxflx7
  - R-hqekjinjpa
  - R-hsflueyc4b
  - R-jsncmqoqjm
  - R-jzujq3ruxn
  - R-l2cviw6kk7
  - R-lpwtvv6ldp
  - R-lwzfbzmgi4
  - R-m7fyerzqti
  - R-nbcb2fosay
  - R-o2d2lmrxaw
  - R-obomewrs7e
  - R-oh4oevufr3
  - R-qrny2tacwz
  - R-rir7dn3eez
  - R-rmwolikuep
  - R-rtualqkge6
  - R-srbpytoxpj
  - R-tkl3lrrlpu
  - R-uvehohexvw
  - R-vaw2ychvkd
  - R-w4xotddy7p
  - R-wa3wnknrlt
  - R-wgi4sahmou
  - R-wkp2oca6xx
  - R-wpeh3aib32
  - R-wqv343j4kd
  - R-xqf3xsumye
  - R-y5tidh72gk
  - R-y6gszx7dg6
  - R-ybmsjjgqtp
  - R-yrk7zcukqy
  - S-qk6cmgqgmt
---

## 맥락

사용자가 요구사항을 Use-Case 3.0처럼 기본 흐름·대체 흐름과 경로별 수용 조건으로 쓰고 싶어 했다. 원문에서 경로는 기본 흐름과 대체 흐름의 조합이고, 경로마다 테스트 케이스를 둔다. 쓰지 않는 프로젝트는 0.8.5와 똑같아야 한다는 제약이 있었다. 이 저장소의 요구사항은 선테스트로 먼저 모두 바꿨다.

## 결정

요구사항 프론트매터 `style: usecase`(없거나 `default`면 기본 형식)로 고른다. 절은 스토리·범위와 제약·사전 조건·기본 흐름·대체 흐름(A1…)·사후 조건·수용 조건이고, 수용 조건마다 `경로:` 줄을 둔다. 형식은 바뀐 요구사항에만 경고한다. 슬라이스는 문서에 두지 않는다. 유즈케이스 모델은 index.md에 Mermaid로 직접 그린다. 이 저장소는 모든 요구사항을 유즈케이스로 둔다.

## 검토한 대안

- 절 제목으로 알아보기(본문을 데이터로 읽는다)
- 키 이름 format·template(저장 형식, 뼈대 선택으로 읽힌다)
- 조건 앞 괄호로 경로 적기(표기가 흔들리고 눈에 덜 띈다)
- check 문제로 막기(쓰는 중 커밋이 불편하다)
- 프론트매터 actor로 모델 자동 생성(저장 규약·계약이 바뀐다)
