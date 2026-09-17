# 제품·지침 문서

기능에 묶이지 않는 내용은 두 곳에 둔다. `.gitifact/product/PRODUCT.md`는 제품 설명 한 파일로, 제품이 무엇이고 누구를 위한 것이며 어떤 원칙과 범위를 갖는지처럼 "누구를 위해 왜 만드는가"를 담는다. README처럼 읽히는 소개 문서이며 브라우저 첫 화면에 그대로 보인다. 기술 구조나 개별 요구사항의 세부는 지침과 기능 명세의 몫이므로 제품 설명에 반복하지 않는다. 본문의 이미지는 같은 폴더에 두고 `./파일명`으로 참조한다. `.gitifact/guides/`는 아키텍처·코드 스타일·데이터 흐름·레이아웃처럼 "어떻게 만드는가"를 여러 문서로 담고 하위 폴더를 자유롭게 둔다.

요청이 제품 설명의 범위 밖이거나 원칙과 어긋나면 진행 전에 알린다. 지침과 어긋나는 설계는 문서를 먼저 고칠지 사용자와 정한다.

## 형식과 저장

각 파일은 첫 줄에 CLI가 발급한 ID 주석(제품은 `gitifact-product: P-난수`, 지침은 `gitifact-guide: G-난수`), 최상위 제목, 본문 순서다. 지침의 폴더·파일 이름은 소문자·숫자·하이픈이다. 손으로 파일을 만들지 말고 `spec save`의 operations로 저장한다.

```json
{
  "expected": "working의 실제 stamp",
  "operations": [
    { "type": "set-product", "title": "제품 이름", "body": "한 문단 정의, 대상 사용자, 원칙, 범위 밖." },
    { "type": "create-doc", "path": "frontend/layout.md", "title": "레이아웃 지침", "body": "규칙과 이유." }
  ]
}
```

제품 설명은 `set-product`(title·body)로 만들거나 갱신하며 ID는 유지된다. 지침은 `update-doc`(id·title·body), 이동·이름 변경은 `move-doc`(id·path), 삭제는 `delete-doc`(id)다. path는 지침 폴더 안 상대 경로이며 `.md`로 끝난다. 문서 본문에는 다른 gitifact 주석을 쓰지 않는다.
