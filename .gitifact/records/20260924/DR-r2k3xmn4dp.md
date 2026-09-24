---
id: DR-r2k3xmn4dp
title: 리소스별 명령 체계와 docs 명령 폐지
docs:
  - I-5x5yhjlk4u
  - I-zdpwuta64o
  - I-2kycwrstxe
  - D-tofdg5dot6
  - D-kcgh3edw6q
  - D-mchu6regnn
  - D-v6phrzooji
  - D-vozyvnajhy
  - D-lapfibde2z
  - D-r4umcdt4c6
  - R-nbcb2fosay
  - R-y5tidh72gk
  - D-pk2piyjyx3
  - D-762ay22bcn
  - D-37iokwacmm
  - R-3ngq5qsdl6
  - R-srbpytoxpj
  - R-ecmf4ddygu
  - R-hqekjinjpa
  - D-m7r675lhb3
  - R-rir7dn3eez
  - R-vaw2ychvkd
  - R-dzowfm436d
  - R-uvehohexvw
  - D-j5ixcrj4g2
---

## 맥락

`docs list`는 파일 목록을 찍는 수준이라 에이전트가 glob·grep 하는 것보다 나을 게 없었다(사용자 판단). 지침은 모든 기능 뒤 맨 끝에 나오고 AGENTS.md와 `references/` 구성이 보이지 않았다. CLI가 grep보다 나은 근거는 관계(설계→요구사항·지침과 그 역방향, 기록→문서), 이력(언제 누가 바꿨나), 상태(초안, 설계 없는 기능, 설계가 다루지 않는 요구사항)다. 0.8.0 배포 전이라 명령 이름을 바꿔도 호환 문제가 없다.

## 결정

명령을 리소스별로 나눠 `specs`·`instructions`·`records`마다 `list`·`show`·`new`를 두고, 목록에 관계·이력·상태 필터와 공통 옵션(`--q`·`--author`·`--sort`·`--limit`·`--fields`·`--format`)을 둔다. 문서 전체 검사는 명세와 지침 사이 참조를 함께 봐야 해서 최상위 `check` 하나로 둔다. `docs`는 없앤다(`docs history` → `records list --doc`, `docs search` → `list --q`). `instructions list`는 AGENTS.md와 지침마다 딸린 파일 수를 보인다.

## 검토한 대안

- 검사까지 리소스마다 나누기(`specs check`, 명세와 지침 사이 참조 문제를 놓친다)
- `docs`를 두고 출력만 개선(에이전트가 지침을 찾는 일이 문장 규칙에 계속 기댄다)
- 전체 대상 명령을 모두 최상위로(`search`·`history`까지, 시스템 명령만 최상위에 둔다는 원칙과 충돌)
