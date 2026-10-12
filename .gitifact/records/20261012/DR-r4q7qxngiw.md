---
id: DR-r4q7qxngiw
title: Gitifact가 프로젝트 지침을 관리하지 않음
docs:
  - S-7ymbd7bqzf
  - R-y5tidh72gk
  - R-rtualqkge6
  - D-r4umcdt4c6
  - R-hjteu77gki
  - R-oh4oevufr3
  - R-nbcb2fosay
  - D-vozyvnajhy
  - D-lapfibde2z
  - D-yuqado4bvo
  - I-5x5yhjlk4u
  - I-zdpwuta64o
  - I-msbvcgybp7
  - I-krc7tyzyfh
  - I-2kycwrstxe
  - D-2hx63xmi32
  - D-37iokwacmm
  - D-3nu5nrwhee
  - D-4kgfn4hrs6
  - D-5u7ezf3zgt
  - D-762ay22bcn
  - D-crtw43mrkq
  - D-j5ixcrj4g2
  - D-jxe47zy5fq
  - D-kcgh3edw6q
  - D-m7r675lhb3
  - D-mchu6regnn
  - D-pk2piyjyx3
  - D-qocsgecvk2
  - D-tofdg5dot6
  - D-v6phrzooji
  - D-vmhb7xlhjb
  - D-xtvtqiygt5
  - D-y2fgchwma5
  - D-znxpyu33sr
  - R-3ngq5qsdl6
  - R-5eehizubwl
  - R-b2q2g4sgsd
  - R-dzowfm436d
  - R-fqlesmxflt
  - R-fypnjx6dju
  - R-hsflueyc4b
  - R-l2cviw6kk7
  - R-m7fyerzqti
  - R-qrny2tacwz
  - R-rir7dn3eez
  - R-tkl3lrrlpu
  - R-vaw2ychvkd
  - R-wgi4sahmou
  - R-wkp2oca6xx
  - S-4snufavmgg
  - S-jqxgddhsdf
  - S-qdsagtcqld
---

## 맥락

0.9.0 준비에서 지침을 Agent Skills로 바꾸고 skills sync로 에이전트 폴더에 두는 기능을 만들었지만, 사본의 커밋 여부와 에이전트별 위치처럼 답을 찾지 못한 문제가 남았다. 사용자는 아직 답을 못 찾은 것을 함께 들고 가는 것이 문제라고 보고, Gitifact를 Git으로 요구사항·설계·결정기록을 관리하는 일에 집중시키기로 했다. 그 작업은 skills-0.9-experiment 브랜치에 보관했다.

## 결정

0.8.6에서 지침 기능(명령, I- 문서, 브라우저 화면, API)을 걷어낸다. 작업 트리에 남은 지침은 폴더마다 INSTRUCTION_MOVED로 막고 guide show migrate 8절이 에이전트의 스킬로 옮기게 안내하며, 옛 커밋의 지침은 이력에서 읽는다. 설계 sources의 I-는 지운다. 이 저장소의 지침은 .agents/skills/로 옮기고, Claude Code용 .claude/skills/는 Git에서 빼고 세션 시작 훅이 복사한다.

## 검토한 대안

- 프로젝트 스킬을 Gitifact가 관리(0.9.0 시험판. 답을 못 찾은 배치 규약이 ID·검사·계약에 묶인다)
- 작업 방법을 gitifact-playbook 스킬로 전달(사본의 위치와 커밋 여부를 다시 정해야 하고, 블록과 guide show로 충분하다)
- 지침을 그대로 유지(Git으로 명세를 관리하는 일과 무관한 영역을 계속 떠안는다)
- 이 저장소의 스킬을 .claude/skills/에 커밋(주 도구는 Claude Code지만 다른 에이전트가 읽는 .agents/skills/를 원본으로 삼았다)
