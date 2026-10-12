---
title: 옛 형식 옮기기
description: schemaVersion 2 프로젝트를 0.8.0 문서 형식으로 옮기는 절차와 전환 커밋, 0.8 프로젝트 지침을 에이전트의 스킬로 옮기는 절차
---

사용자가 0.7 형식(`.gitifact/config.json`의 `schemaVersion: 2`) 프로젝트를 0.8.0 문서 형식(schemaVersion 3)으로 옮겨 달라고 하면 1~7절의 절차를 따른다. 0.8의 프로젝트 지침(`.gitifact/instructions/`)만 남은 프로젝트는 8절을 따른다. CLI에는 변환 명령이 없으므로 에이전트가 옛 파일을 직접 읽고 새 구조로 쓴다. 끝나면 "보고" 절의 형식으로 알린다.

이 지침에서 `gitifact`는 이 지침을 출력한 CLI(0.8.0 이상)의 실행 방법이다. 0.7.x CLI는 쓰지 않는다. 0.8.0 CLI는 schemaVersion 2 프로젝트의 조회를 거부하므로, 3절에서 설정을 바꾸기 전까지는 파일을 직접 읽는다.

## 1. 시작 전에 확인할 것

- `git status`가 깨끗해야 한다. 커밋되지 않은 변경이나 staging이 있으면 멈추고 사용자에게 알린다.
- 옛 형식으로 `.gitifact/`를 고친 **열린 브랜치**가 있으면 전환 전에 합치라고 사용자에게 알리고, 합칠지 계속할지 확인받는다. 전환 뒤에 옛 형식 브랜치를 합치면 두 형식이 섞이고 `gitifact check`가 실패한다.
- 전환은 마지막에 한 커밋으로 남긴다. 커밋 권한이 있는지 사용자에게 확인한다. 가능하면 새 브랜치에서 작업하고 검증 뒤 합친다.
- 새 형식은 이 지침의 3절이 전부 설명한다. 형식이 헷갈리면 프로젝트 밖의 빈 Git 저장소에서 `gitifact init`과 `gitifact specs new feature|requirement|design …`를 실행해 CLI가 만드는 뼈대를 보고, `gitifact check`로 맞는지 확인한다.

## 2. 옛 형식 읽기

| 옛 파일 | 형식 |
| :--- | :--- |
| `.gitifact/spec/<기능>/requirements.md` | 프론트매터 `id: S-…`, 본문 첫 줄 `# 기능 제목`. `# 제목`과 첫 `## ` 사이에 문단이 있으면 그것이 기능의 소개다. 요구사항마다 `## 요구사항 제목` 다음 줄에 `<!-- gitifact-req: R-… -->`, 그 아래부터 다음 `## `까지(코드 블록 안 제외)가 요구사항 본문 |
| `.gitifact/spec/<기능>/design.md` (있을 때) | 프론트매터 `id`(기능과 같은 S-)와 선택적 `sources`(`title`, `path` 또는 `url`, `note`). 본문 첫 줄 `# 설계 제목`, 절 아래에 `<!-- gitifact-ref: R-…[, R-…] -->` |
| `.gitifact/spec/<기능>/history.jsonl` | 한 줄에 `{"id":"H-…","requirements":[R-…],"designs":[S-…]?,"documents":[W-…]?,"reason":"…"}` |
| `.gitifact/wiki/**/*.md` | 프론트매터 `id: W-…`, 본문 첫 줄 `# 페이지 제목` |
| `.gitifact/wiki/history.jsonl` | 위와 같은 이유 줄. 대상은 주로 `documents` |

시작 전에 개수를 세어 둔다: 기능(`requirements.md`) 수, 요구사항(`gitifact-req` 주석) 수, 설계(`design.md`) 수, 위키 페이지 수. 4절에서 대조한다.

## 3. 새 구조로 옮기기

모든 구조 정보는 프론트매터에만 둔다. 본문에는 `#` 제목과 `<!-- gitifact-` 주석을 쓰지 않는다(코드 블록 안은 예외). 제목(`title`)은 200자, 설명(`description`)은 300자 이하의 한 줄이며 모두 필수다.

1. **설정:** `.gitifact/config.json`의 `schemaVersion`을 3으로 바꾼다. `baseline`은 그대로 둔다.
2. **기능:** `.gitifact/spec/<기능>/index.md`를 만든다.
   ```markdown
   ---
   id: S-…            # 옛 requirements.md의 id 그대로
   title: 기능 제목    # 옛 # 제목 그대로
   description: 이 기능이 무엇인지 한 줄
   ---

   (옛 파일의 소개 문단이 있으면 그대로, 없으면 이 기능의 범위와 목적을 한두 문장으로 쓴다. 본문은 필수)
   ```
3. **요구사항:** 요구사항마다 `.gitifact/spec/<기능>/requirements/<slug>.md`를 만든다. slug는 제목을 나타내는 영어 소문자·숫자·하이픈(80자 이하)이다. `order`는 옛 파일의 순서대로 10, 20, 30…이다. 본문은 옛 요구사항 본문을 **한 글자도 바꾸지 않고** 옮긴다(`###` 소제목도 그대로). 본문 앞뒤의 빈 줄만 잘라 낸다.
   ```markdown
   ---
   id: R-…
   title: 요구사항 제목
   description: 무엇을 요구하는지 한 줄
   order: 10
   ---

   (옛 본문 그대로)
   ```
4. **설계:** 옛 design.md가 있는 기능마다 `gitifact specs new design <기능>/overview --title "<옛 설계 제목>" --description "<한 줄>"`을 실행해 D- ID를 받는다. 이 명령이 만든 `design/overview.md`의 본문을 옛 설계 본문(첫 줄 `# 설계 제목`은 뺀다)으로 바꾸고 `draft: true` 줄을 지운다. 이어서:
   - 옛 본문의 `<!-- gitifact-ref: … -->` 줄은 지우고, 거기 적힌 R- ID를 모두 모아 중복 없이 프론트매터 `requirements`에 적는다.
   - 옛 `sources`는 `path`면 그 경로가 가리키는 위키 페이지의 W- ID로 `- id: W-…`(`note`가 있으면 함께), `url`이면 `- title: …` / `url: …`로 옮긴다. W-는 5단계에서 지운다.
   - 본문의 나머지는 바꾸지 않는다. `specs new`가 넣은 `order: 10`은 그대로 둔다. 설계를 관점별 파일(data, interface, ui, errors 등)로 나누는 것은 전환 커밋에서 하지 않는다. 옮긴 본문을 대조할 수 있게 overview 하나로 옮기고, 나누기는 전환 뒤 별도 커밋으로 `gitifact guide show design`에 따라 한다.
   - 결과의 프론트매터는 이 모양이다. 새 형식의 참고 문서에는 `title`이 없으므로, 위키 페이지를 가리키던 옛 `title`은 사라진다.
     ```markdown
     ---
     id: D-…
     title: 옛 설계 제목
     description: 한 줄
     order: 10
     requirements:
       - R-…
       - R-…
     sources:
       - title: 외부 문서 제목
         url: https://…
     ---
     ```
5. **위키:** 위키는 0.8.0에서 없어졌고, 프로젝트에서 일하는 방식은 Gitifact가 관리하지 않는다. 위키 페이지가 `.gitifact/wiki/`에 남아 있으면 `check`가 `WIKI_REMOVED`로 막는다. 페이지마다 옮길 곳(에이전트의 스킬 폴더, AGENTS.md의 블록 밖, 또는 `docs/` 같은 일반 문서)을 표로 사용자에게 보여 주고 확인받은 뒤 옮긴다. 옮긴 파일은 Gitifact 문서가 아니므로 ID가 없다. 프론트매터의 `id: W-…` 줄을 지우고 첫 줄 `# 제목`은 그대로 둔다. 스킬로 옮기면 그 에이전트의 스킬 형식을 따른다(8절의 2·3단계).
   - 4단계에서 설계 `sources`에 적은 `- id: W-…` 항목은 지운다. 근거를 남겨야 하면 설계 본문에 옮긴 파일의 경로를 적는다.
   - 옛 W- ID는 문서에서 사라지고 0.7 커밋의 이유에만 남는다.
   - 위키 페이지를 다시 묶거나 다듬는 일은 전환 커밋에서 하지 않는다. 옮긴 본문을 대조할 수 있게 그대로 옮기고, 다듬기는 전환 뒤 별도 커밋으로 한다.
6. **상대 링크:** 요구사항·설계가 새 경로로 옮겨졌으므로, 문서 본문의 상대 링크 중 옛 `requirements.md`·`design.md`를 가리키거나 파일 위치가 바뀌어 깨지는 것을 새 경로로 고친다(요구사항·설계 본문은 한 단계 깊어졌다). 위키 페이지로 가던 링크는 그 페이지가 옮겨 간 파일로, 옮긴 파일 안의 링크는 새 위치 기준으로 고친다. 링크를 고치는 것 외에 본문을 다듬지 않는다.
7. **이유:** 옛 history.jsonl의 이유는 옮기지 않는다. 0.7 커밋에 남아 있어 전환 뒤에도 이력(`records list --doc`, 브라우저)에 그대로 보인다. 0.8.0에서 새로 생기는 변경의 이유는 결정기록으로 남긴다(`gitifact guide show records`). 전환 커밋에는 결정기록을 쓰지 않는다. 전환 커밋은 이력에서 숨겨진다.
8. **옛 파일 삭제:** 모든 `.gitifact/spec/<기능>/requirements.md`, `design.md`, `history.jsonl`과, 5단계에서 페이지를 모두 옮긴 `.gitifact/wiki/` 폴더 전체(`wiki/history.jsonl` 포함)를 일반 파일 삭제로 지운다. `git rm`은 staging을 만들어 5절의 커밋이 거부되므로 쓰지 않는다. 이미 staging됐다면 `git restore --staged <경로>`로 푼다.

기계적인 부분(파일 나누기, 위키 페이지 옮기기)은 일회성 스크립트로 해도 된다. 스크립트는 프로젝트 밖에 두고 커밋하지 않는다. slug·description·기능 본문은 내용을 읽고 직접 쓴다. 기능·요구사항마다 description이 하나씩 필요하므로 전환에서 가장 큰 일이다(기능 18개·요구사항 45개면 63개). description은 그 문서가 무엇을 요구하거나 다루는지를 목록에서 한 줄로 알아볼 수 있게 쓴다. 제목을 되풀이하지 말고 사용자 스토리나 첫 문단의 핵심을 줄인다.

**예외로 허용되는 것:** 평소에는 ID를 CLI만 발급하고 커밋된 이유를 고치지 않는다. 이번 전환에서만 기존 S-·R- ID를 옮겨 적는다. 새 ID를 지어내지 않는다(설계 D-는 `specs new`로 받는다).

## 4. 검증

1. `gitifact check`가 `문제 없음`이어야 한다. 문제가 있으면 고친다.
2. 2절에서 센 개수와 대조한다: 기능 수 = `index.md` 수, 요구사항 수, 설계 수(기능별 `design/overview.md`), 위키 페이지 수(5단계에서 옮긴 파일 수). 문서는 `gitifact specs list --format json`으로 센다.
3. 옛 ID가 모두 새 문서에 있는지 확인한다. 옛 ID는 `git grep -ohE '(S|R)-[a-z2-7]{10}' HEAD -- .gitifact`의 정의 위치(프론트매터 `id`, `gitifact-req` 주석)에서, 새 ID는 `gitifact specs list --format json`의 `documents[].id`에서 모은다. `.gitifact/wiki/`와 `history.jsonl` 파일이 남지 않았고 설계 `sources`에 W-가 없어야 한다.
4. `gitifact changes list`의 마지막에 `문서 검사: 문제 없음`이 나와야 한다. 이 시점의 다른 출력은 전환에서 정상이다: 옛 형식은 새 파서로 읽히지 않으므로 모든 문서가 `created`로 나온다. 새로 만든 문서에는 결정기록이 필요 없다. 커밋을 막지 않는다.

## 5. 커밋

`gitifact changes list`가 알려 준 입력 파일 경로에 JSON을 쓰고 `gitifact changes commit --file <그 경로>`를 실행한다. 먼저 `--dry-run`으로 확인한다. `paths`는 `git status --porcelain --untracked-files=all`에 나오는 경로 전부다(`.gitifact/cache/`는 스스로 제외되어 나오지 않는다). `evidence`에는 사용자가 전환과 커밋을 요청한 말을 인용한다.

```json
{
  "paths": ["<바뀌거나 새로 생기거나 지워진 모든 경로: .gitifact/config.json, 새 문서들, 지운 옛 파일들>"],
  "message": "chore(gitifact): migrate to the 0.8.0 document format",
  "authorization": { "basis": "user-request", "evidence": "<사용자가 전환과 커밋을 요청한 말>" },
  "migration": true
}
```

- 전환 커밋은 경로를 5,000개까지 받는다(일반 커밋은 128개). 5,000개를 넘으면 여러 커밋으로 나누고, 모든 커밋에 `migration: true`를 넣어 이력에서 숨긴다.
- `migration: true`가 있어야 `Gitifact-Migration: 0.8.0` 트레일러가 붙는다. 이 커밋이 이력의 경계가 되어, 그 이전 활동은 뷰어에서 그대로 보이고 이 커밋은 활동에 나오지 않는다.
- 결정기록은 넣지 않는다. 0.7 이유는 0.7 커밋에서 읽힌다.
- 지운 옛 파일도 `paths`에 넣어야 한다. 빠지면 CLI가 거부한다.

## 6. 전환 뒤 정리

- 에이전트 지침 파일의 GITIFACT 블록을 `gitifact update`로 새 버전에 맞춘다. 블록 밖의 프로젝트 지침(AGENTS.md, CLAUDE.md 등)에 `spec working`, `spec save`, `spec commit`, `docs <topic>` 같은 옛 명령이 있으면 새 명령(`specs`·`records`의 `list`·`show`·`new`, `check`, `changes list`·`commit`, `guide show`)으로 바꿔 별도 커밋으로 남길지 사용자에게 묻는다.
- 0.7.x 브라우저가 만든 옛 색인 `<git 공용 폴더>/gitifact/`(보통 `.git/gitifact/`)가 있으면 지워도 된다고 알린다. 0.8.0은 쓰지 않으며, 지우는 것은 사용자에게 맡긴다.
- 0.8.0의 캐시는 `.gitifact/cache/`에 생기고 스스로 Git에서 제외된다. 첫 조회는 이력을 처음부터 읽어 몇 초 걸릴 수 있다.
- 옮긴 위키 페이지 중 결정 기록(ADR)을 결정기록(`gitifact guide show records`)으로 바꾸는 정리, 페이지를 다시 묶는 정리는 사용자와 정해 별도 커밋으로 한다. 전환 커밋은 숨겨지므로 이 커밋에서 쓴 결정기록이 이력에 보인다.
- 전환 커밋에서는 본문을 다듬지 않았으므로, 옮긴 파일이나 명세 본문에 `requirements.md`·`spec save` 같은 옛 형식 서술이나 위키를 가리키는 문장이 남아 있을 수 있다. 찾은 위치를 보고하고, 고치는 것은 사용자와 정해 별도 커밋으로 한다.

## 7. 보고

- 옮긴 개수: 기능·요구사항·설계·위키 페이지(옛 개수와 함께), 위키 페이지가 옮겨 간 곳의 표
- `check` 결과와 대조 결과
- 고친 상대 링크, 옮기지 못했거나 판단이 필요했던 것
- 커밋 해시(했다면), 남은 정리(옮긴 파일의 옛 명령)

## 8. 0.8 프로젝트 지침 옮기기

0.9.0부터 Gitifact는 프로젝트에서 일하는 방식(지침)을 관리하지 않는다. `.gitifact/instructions/`가 남아 있으면 `check`가 폴더마다 `INSTRUCTION_MOVED`로 막는다. 문서 형식(schemaVersion 3)은 그대로이고, 사용자가 동의하면 다음 순서로 옮긴다.

1. 지침을 어디로 옮길지 사용자에게 묻는다. 에이전트마다 스킬 폴더가 다르다(Claude Code는 `.claude/skills/<이름>/SKILL.md`, Codex·Cursor·Gemini CLI·GitHub Copilot 등은 `.agents/skills/<이름>/SKILL.md`). 여러 에이전트를 쓰면 쓰는 쪽마다 두거나 스킬 배포 도구를 쓴다. 스킬로 두지 않고 AGENTS.md의 블록 밖에 합칠 수도 있다.
2. `.gitifact/instructions/<이름>/`을 정한 스킬 폴더의 `<이름>/`으로 옮기고 `index.md`를 `SKILL.md`로 바꾼다. `references/` 등 다른 파일은 그대로 둔다.
3. 프론트매터를 그 에이전트의 스킬 형식으로 바꾼다. Agent Skills 형식이면 `name: <폴더 이름>`과 `description`을 남기고 `id`·`title`은 지운다. 본문 안 링크가 새 위치에서 깨지면 고친다.
4. AGENTS.md의 블록 밖에 있던 지침 색인은, 스킬로 옮겼으면 에이전트가 스킬 설명을 직접 보므로 지운다. AGENTS.md에 합쳤으면 그 위치를 가리키게 고친다.
5. 설계의 `sources`에서 `- id: I-…` 항목을 지운다. 옮긴 지침은 Gitifact 문서가 아니므로 ID로 가리킬 수 없다(`MISSING_REFERENCE`). 근거를 남겨야 하면 설계 본문에 그 스킬의 경로를 적는다.
6. `gitifact check`로 문제가 없는지 확인한다. 옮긴 사실을 결정기록 하나로 남긴다. `docs`에는 지운 지침의 I-와 `sources`를 고친 설계를 적는다(`gitifact guide show records`). 지운 지침 파일, 새 스킬 파일, 고친 설계와 AGENTS.md, 결정기록을 함께 커밋한다(`gitifact guide show commit`). 한 커밋은 경로 128개까지이므로 넘으면 나눈다.

옛 지침(I-)은 0.9.0 이전 커밋에 남아 이력(`records list --doc`, 브라우저)에서 읽힌다. 그 커밋의 원문은 `gitifact specs show <I-ID> --ref <커밋>`으로 본다.
