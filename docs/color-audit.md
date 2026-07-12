# CommercialRadar 색감 진단 — "AI스러움" 분석

> 작성일: 2026-07-12 · 대상: `src/styles/tokens.css` (Figma Ltyz6Iq75ODccjCDJbx8Wp 추출 팔레트)

## 요약
- **다행인 점**: AI 슬롭의 최대 신호인 **보라/인디고 그라디언트, 글래스모피즘, 네온 청록**이 전혀 없다. 그라디언트는 스켈레톤 로딩 셔머 4곳뿐.
- **문제인 점**: 팔레트의 절반이 **Tailwind 기본값 그대로**라서 "어디서 본 듯한 AI 생성 대시보드" 인상을 준다. 특히 primary가 Tailwind `blue-700`과 사실상 동일.

## 🤖 AI스럽다고 평가받는 색감 (Tailwind 기본값 계열)

| 토큰 | 값 | 정체 | 왜 AI스러운가 |
|---|---|---|---|
| `--color-primary` | `#1d4fd8` | Tailwind **blue-700**(`#1d4ed8`)과 1글자 차이 | AI가 만드는 대시보드의 국민 파랑. 가장 강한 신호 |
| `--color-primary-light` | `#eff6ff` | Tailwind **blue-50** 그대로 | 배지/pill 배경 전부 이 색 → "Tailwind 티" |
| `--color-text` | `#0f172a` | Tailwind **slate-900** 그대로 | |
| `--color-text-body` | `#374151` | Tailwind **gray-700** 그대로 | |
| `--color-muted` | `#64748b` | Tailwind **slate-500** 그대로 | |
| `--color-border-strong` | `#cbd5e1` | Tailwind **slate-300** 그대로 | |
| `--color-amber` | `#f59e0b` | Tailwind **amber-500** 그대로 | AI 산출물의 단골 경고색 |
| `--color-red` | `#c2410c` | Tailwind **orange-700** 그대로 | |

> 공통 문제: 개별 색이 나쁜 게 아니라, **조합 전체가 "Tailwind 기본 팔레트 + 파란 SaaS 대시보드"라는 가장 흔한 AI 출력 패턴**과 일치한다.

## ✋ AI스럽지 않은 색감 (커스텀, 유지 가치 있음)

| 토큰 | 값 | 평가 |
|---|---|---|
| `--color-orange` / `-bg` | `#e8833a` / `#fdf1e7` | 흔한 amber가 아닌 **따뜻한 번트 오렌지**. 팔레트에서 가장 개성 있는 색 |
| `--color-green` / `-bg` | `#1b8a5a` / `#e7f6ee` | Tailwind emerald(`#10b981`)가 아닌 **차분한 딥그린** |
| `--color-bg` / `--color-chip` | `#f4f6fb` | 순회색이 아닌 **은은한 블루 틴트 배경** |
| `--color-border` / `--color-line` | `#e6eaf0` / `#eef1f6` | 커스텀 쿨그레이, 자연스러움 |
| `--color-faint` | `#8a94a6` | 커스텀 |
| `--color-primary-dark` / `-soft` | `#2b49a8` / `#dce6f8` | 커스텀 파생값 |
| 시리즈 색 (`series-1~3`) | 파랑·오렌지·그린 | 보라·청록 조합을 피한 좋은 데이터 시각화 선택 |

## 🎨 권장 개선 방향

핵심 전략: **"파랑을 버리는 게 아니라, '그 파랑'을 버린다."** 상권·부동산 데이터 서비스이므로 신뢰감 있는 블루 계열은 유지하되, Tailwind 값에서 미세하게 이동시켜 고유 톤을 만든다.

### 1순위 — Primary 교체 (효과 가장 큼)
```css
/* 현재: Tailwind blue-700 복제 */
--color-primary: #1d4fd8;
/* 제안: 살짝 남색으로 깊고 채도를 죽인 코발트 — "금융/데이터 신뢰" 톤 */
--color-primary: #2447c7;
--color-primary-dark: #1a2f7d;
--color-primary-light: #edf2fc; /* blue-50 대신 자체 파생 */
--color-primary-soft: #d7e1f7;
```

### 2순위 — 중립색(그레이)을 브랜드 틴트로 통일
slate와 gray가 섞여 있다(`slate-900` + `gray-700`). 배경 `#f4f6fb`처럼 블루 틴트가 도는 계열로 통일:
```css
--color-text: #131b2e;
--color-text-body: #3b4356;
--color-muted: #6b7590;
--color-border-strong: #c6cede;
```

### 3순위 — 경고/위험색을 오렌지 축에 정렬
가장 개성 있는 `#e8833a`(번트 오렌지)를 기준 삼아 amber/red를 같은 온도로:
```css
--color-amber: #e9a23b;
--color-red: #c73e2e;
```

### 유지할 것
`#e8833a` 오렌지, `#1b8a5a` 그린, `#f4f6fb` 배경, 시리즈 3색 구성, 그라디언트 없는 절제된 스타일.

### 적용 방법
토큰이 `tokens.css` 한 파일에 모여 있어 값 교체만으로 전 화면에 일괄 적용된다. 단, 모듈 CSS에 토큰과 동일한 hex가 하드코딩된 곳 몇 군데는 `var()` 참조로 정리 필요.
