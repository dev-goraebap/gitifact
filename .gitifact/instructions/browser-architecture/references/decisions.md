# 브라우저 결정 표

브라우저 코드에 걸친 결정이다. 패키지 경계와 읽기 전용 원칙은 [CLI 결정 표](../../cli-architecture/references/decisions.md)에 있다.

| 결정 | 이유 | 기각한 안 |
| :--- | :--- | :--- |
| 문서 다이어그램에 한해 mermaid 11(11.17.2)을 번들에 담고 동적 import로 자기 청크에 둔다. CDN에서 받지 않는다 | 설계의 흐름도·순서도는 손으로 SVG를 쓸 수 없고 원문 표기는 mermaid 펜스다. 다이어그램 없는 문서는 청크를 받지 않아 첫 화면이 그대로다. 대가는 배포 크기(`apps/cli/dist` 2.8MB → 6.2MB, 대부분 elk 1.4MB·cytoscape 0.4MB·katex 0.3MB 같은 종류별 청크)이고, 종류를 골라 담는 것은 이후 과제다 | mermaid 12.0.0(라벨 폭을 늘 120px로 재 긴 라벨이 잘림), 집계 차트에 차트 라이브러리 쓰기 |
| fastdom·strictdom의 MIT 전문은 README 절을 `apps/cli/licenses/`에 보관해 notices 생성기가 쓴다 | 두 패키지가 라이선스 파일 없이 README에 전문을 둔다 | 고지 누락 |
| 본문의 영문도 Pretendard로 쓴다 | Pretendard의 영문 자형이 Inter 기반이라 따로 둘 이득이 없다 | 영문만 Inter로, 영문만 JetBrains Mono로(본문이 코드처럼 보임) |
| Pretendard는 한 파일(2.0MB)로 번들한다 | 로컬 서버라 나눠 받는 이득이 없고 패키지가 더 커진다 | 나눠 받는 판(92개 파일, 3.1MB) |
| 휠 감속은 Lenis로 한다 | 브라우저의 `scroll-behavior: smooth`는 앵커와 scrollTo에만 먹고 휠에는 효과가 없다 | `scroll-behavior: smooth` |
