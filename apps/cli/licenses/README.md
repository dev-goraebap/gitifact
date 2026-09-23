# Bundled license sources

The installed Astryx 0.6.0 and StyleX 0.19.0 packages declare MIT but omit a
standalone license file. These copies were retrieved from their official
repositories on 2026-09-13 and are included in generated runtime notices.

- [Astryx LICENSE](https://github.com/facebook/astryx/blob/ae9ccef67c09a036c1f2e273e783ae78cd8d2c67/LICENSE)
- [StyleX LICENSE](https://github.com/facebook/stylex/blob/ee1d8a914109051af62d61419898cb5889b8ce46/LICENSE)

Other notice texts come from the installed runtime packages. Updating the
affected package versions requires reviewing these explicit fallback mappings.

Hugeicons: @hugeicons/core-free-icons 4.3.0 패키지에 라이선스 원문이 없어 공식 https://github.com/hugeicons/hugeicons/blob/main/LICENSE.md 에서 가져온 MIT 원문을 hugeicons-LICENSE에 보관한다. 원본 API: https://api.github.com/repos/hugeicons/hugeicons/license (2026-09-14 확인). 패키지 버전별 누락 보완에만 사용한다.

fastdom 1.0.12·strictdom 1.0.1(mermaid 11의 전이 의존성)은 패키지에 라이선스 파일 없이 README의 "## License" 절에 MIT 전문을 둔다. 그 절을 그대로 옮겨 fastdom-LICENSE·strictdom-LICENSE에 보관한다(2026-09-19, 설치된 패키지에서 추출). 두 버전을 올릴 때 이 대응을 다시 확인한다.

Pretendard 1.3.9는 OFL 원문을 패키지 루트가 아니라 `dist/LICENSE.txt`에 둔다. 그 파일을 그대로 pretendard-LICENSE에 복사했다(2026-09-23, 설치된 패키지에서). 버전을 올릴 때 이 대응을 다시 확인한다.
