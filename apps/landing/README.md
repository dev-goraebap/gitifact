# Gitifact 랜딩페이지

사용자 스토리에서 저장 구조로 이어지는 정적 웹사이트다. 스토리와 아키텍처 장면은 설명용 예시이며 실제 저장소 데이터를 읽지 않는다. 제품 현황은 로컬 `gitifact browser`에서 본다.

```sh
pnpm dev:landing
pnpm --filter @gitifact/landing build
```

빌드 산출물은 `apps/landing/dist/`에 나온다. 정적 자산을 제공하는 호스팅에 이 디렉터리를 연결하면 된다. Cloudflare Workers 배포 시에도 이 디렉터리를 자산 디렉터리로 사용한다. 배포 계정과 도메인은 아직 연결하지 않았다.
