# 왜 "클로드로 짠 것 같다"는 인상을 주는가 — 감사 보고서

> 작성일: 2026-07-13 · 감사 범위: `src/` 전체 (pages, components, styles, hooks, services)

## 요약

실제 코드를 전수 검토한 결과, "AI로 만든 것 같다"는 인상은 단일 원인이 아니라 **5개 레이어가 동시에 겹치면서** 생긴다. 색이 나쁜 게 아니고, 카피가 틀린 게 아니고, 레이아웃이 엉터리인 게 아니다. 문제는 모든 페이지가 **정확히 동일한 패턴을 동일한 리듬으로 반복**하는 데 있다. AI가 컨텍스트 없이 "대시보드 페이지를 만들어줘"라고 요청받으면 출력하는 것이 바로 이 구조다. 기능 구현 품질 자체는 높지만, '사람 손맛'이 느껴지는 변주나 예외적 결정이 거의 없다.

---

## 1. 비주얼 — 컬러·레이아웃

| # | 신호 | 파일:라인 | 심각도 |
|---|------|-----------|--------|
| V1 | Primary blue `#2447c7`가 Tailwind `blue-700`(`#1d4ed8`)과 채도·명도 차이가 거의 없는 복제 수준. Primary light `#edf2fc`도 Tailwind `blue-50`과 사실상 동일. 데이터 SaaS 대시보드의 가장 흔한 AI 출력 팔레트. | `src/styles/tokens.css:4–7` | 상 |
| V2 | Hero 섹션이 `radial-gradient + 격자 배경(heroGrid) + 중앙 텍스트 + 서치바` 구성으로, Vercel/Linear/Notion 랜딩의 복사판 구조. | `src/pages/LandingPage.module.css:124–143` | 상 |
| V3 | 모든 앱 내부 페이지(Dashboard·Ranking·Trends·Compare·MyPage)가 `h1 title → p subtitle → 카드/그리드` 3단 헤더+본문 패턴을 일관되게 반복. 구별되는 레이아웃 예외가 없음. | `src/pages/RankingPage.tsx:74–79`, `TrendsPage.tsx:104–111`, `ComparePage.tsx:240–251`, `MyPage.tsx:192–197` | 상 |
| V4 | `⤢` 유니코드 문자를 expand 버튼 아이콘으로 5곳 이상 동일 패턴 사용. 실제 브라우저에서 렌더링이 들쑥날쑥한 문자. | `src/pages/ComparePage.tsx:33`, `src/components/dashboard/ScoreCard.tsx:56`, `SurvivalCard.tsx:80` | 중 |
| V5 | 섹션 구분선(`accentBar`)을 `DashboardPage`, `TrendsPage`, `ComparePage` 3개 페이지가 동일한 방식(4px 파란 세로 바)으로 복사 사용. | `src/pages/DashboardPage.module.css:92–98`, `TrendsPage.tsx:131`, `ComparePage.tsx:265` | 중 |
| V6 | 카드 공식이 전 화면 동일: `border: 1px solid var(--color-border) + border-radius: var(--radius-lg) + box-shadow: var(--shadow-card)`. 시각적 무게 차이가 없음. | `src/pages/DashboardPage.module.css:112–120`, `LandingPage.module.css:240–246` | 중 |
| V7 | `AtmosphereSimulation`에서 낮/밤 구분 태그로 `☀️`, `🌙` 이모지를 인라인으로 사용. | `src/components/charts/AtmosphereSimulation.tsx:179–180` | 하 |

---

## 2. 카피/문구

| # | 신호 | 파일:라인 | 심각도 |
|---|------|-----------|--------|
| C1 | **"~없어요"** 빈 상태 문구가 10곳 이상 동일 형식으로 반복. `데이터가 없어요.` / `상권이 없어요.` / `리포트가 없어요.` 모두 같은 끝말. | `Dashboard:484`, `RankingPage:110`, `ComparePage:175,203,411`, `TrendsPage:180,205`, `MyPage:279,301,308` | 상 |
| C2 | **"~못했어요. 잠시 후 다시 시도해주세요."** 에러 문구가 4개 페이지에서 토씨 하나 다르지 않게 반복. | `DashboardPage:411`, `RankingPage:108`, `TrendsPage:178`, `ComparePage:123` | 상 |
| C3 | **"한눈에"** 키워드가 4개 페이지 subtitle에 등장. `한눈에 비교하세요`, `한눈에 확인합니다`, `한눈에 살펴보세요`, `한눈에 비교합니다`. AI 마케팅 카피의 가장 흔한 상투어. | `RankingPage:77`, `TrendsPage:109`, `ComparePage:160`, `HeroSection:18` | 상 |
| C4 | 히어로 검색창 placeholder가 `"지역명과 원하는 상권을 입력해 보세요!"` — AI 카피의 과잉 친절 패턴. 실제 검색창 placeholder로는 너무 길고 설명적. | `src/components/landing/HeroSection.tsx:25` | 중 |
| C5 | MyPage 인터레스트 카드 memo placeholder가 `"메모를 입력하세요"` — 기능 없음, 개성 없음. | `src/components/mypage/InterestCard.tsx:81` | 중 |
| C6 | SurvivalCard 부제: `"100곳 중 ${survivors}곳이 남아요"` — 의도는 친근함인데, 단위(곳)와 결합하면 번역체처럼 들림. | `src/components/dashboard/SurvivalCard.tsx:62` | 중 |
| C7 | 랜딩 기능 섹션 h2가 `"창업 결정에 필요한 모든 데이터, 한 곳에"` — SaaS 랜딩 AI 카피의 전형 문구. | `src/components/landing/FeaturesSection.tsx:12` | 하 |
| C8 | Stats 섹션 수치(`150,000건+`, `50,000명+`, `424개`)가 하드코딩. 실제 서비스 데이터와 연결 없음을 알 수 있는 과도하게 깔끔한 숫자. | `src/components/landing/data.ts:101–104` | 하 |

---

## 3. UX 패턴

| # | 신호 | 파일:라인 | 심각도 |
|---|------|-----------|--------|
| U1 | **세그먼트 컨트롤(탭)**이 `RankingPage`, `TrendsPage`, `MyPage` 세 페이지에서 동일한 `segBtn / segBtnActive` 패턴으로 반복. 스타일도 동일, role="tablist" 구현도 동일. | `RankingPage:82–94`, `TrendsPage:140–151`, `MyPage:245–258` | 상 |
| U2 | **스켈레톤 로딩** 패턴이 4개 페이지에서 동일한 shimmer 애니메이션 + `.skeleton` className으로 반복. CSS도 4군데 복사. | `DashboardPage:397–400`, `RankingPage:102–104`, `ComparePage:110–113`, `TrendsPage:176` | 중 |
| U3 | **SectionTitle 컴포넌트**(accentBar + h2 + p 구조)가 `DashboardPage`와 `ComparePage`에서 각각 지역 함수로 별도 정의되어 있음. 추상화하지 않은 복사. | `DashboardPage:619–628`, `ComparePage:254–271` | 중 |
| U4 | `ComparePage`의 `+ 상권 추가` 버튼과 필터 드롭다운(`2026년 1분기 ▾`, `전체 업종 ▾`)이 기능 없는 더미로 방치. UI는 완성형처럼 보이지만 동작하지 않음. | `src/pages/ComparePage.tsx:138–155` | 상 |
| U5 | 로딩 문구가 `"불러오는 중…"` 으로 통일. `MyPage:163`, `MapPage SangkwonPanel:128`, `GangnamCafeDemoPage:53` 모두 동일. | 위 파일들 | 하 |

---

## 4. 코드 스타일

| # | 신호 | 파일:라인 | 심각도 |
|---|------|-----------|--------|
| K1 | 단일 컴포넌트 JSDoc이 `/** Figma 2262:3601 재현. */` 형식으로 여러 곳에 달려 있음. 실제 다른 사람이 읽을 문서가 아니라 AI가 자신의 작업 컨텍스트를 기록한 패턴. | `ScoreCard.tsx:33`, `SurvivalCard.tsx:35`, `RentCard.tsx:22` | 중 |
| K2 | `AtmosphereSimulation.tsx` 가 전체 약 300줄 중 90줄이 인라인 `style={{}}`. 같은 파일에서 일부는 CSS Module로 처리되어 일관성 없음. AI가 빠르게 코드를 생성할 때 나오는 패턴. | `src/components/charts/AtmosphereSimulation.tsx:152–291` | 중 |
| K3 | `TrendsPage.tsx`의 상권 목록이 `const DISTRICT_OPTIONS = [{ id: 1, name: "역삼역" }, ...]` 정적 하드코딩. 검색 API를 붙이지 않은 채 "일단 돌아가는" 상태로 방치. | `src/pages/TrendsPage.tsx:19–25` | 중 |
| K4 | `Promise.allSettled` + `alive` 플래그 패턴이 `DashboardPage`, `RankingPage`, `TrendsPage`, `MyPage`, `ComparePage` 모두에서 동일한 구조로 반복. 추상화 없이 복사. | 위 파일들 각 useEffect | 하 |
| K5 | `public/` 폴더에 favicon.svg 참조만 있고 실제 파일 없음. OG 태그(`og:image`, `og:description`, `twitter:card`) 완전 미설정. | `index.html:5` | 상 |
| K6 | `src/assets/react.svg`, `src/assets/vite.svg`가 프로젝트에 그대로 남아 있음. 초기 Vite 스캐폴딩 파일 미정리. | `src/assets/` | 하 |

---

## 5. 브랜드 아이덴티티

| # | 신호 | 파일:라인 | 심각도 |
|---|------|-----------|--------|
| B1 | 사이드바 로고가 지도 핀 SVG + "상권레이더" 텍스트. 별도 로고 디자인 없이 범용 아이콘 재사용. | `src/components/layout/Sidebar.tsx:71–78` | 중 |
| B2 | 랜딩 헤더 브랜드마크가 파란 사각형 박스에 "R" 이니셜 없이 빈 사각형 처리. 브랜드 마크 부재. | `src/pages/LandingPage.module.css:29–38` | 중 |
| B3 | 폰트가 `Noto Sans KR + Inter`. 한국 SaaS/스타트업 AI 결과물의 90% 이상이 동일 조합. `Pretendard`로도 안 넘어간 채 가장 무난한 선택. | `src/styles/tokens.css:55–56` | 하 |

---

## 6. 사람 손맛을 더하기 위한 구체적 개선 제안

### 우선순위 1 — 카피 리라이트 (즉시 실행, 코드 변경 없음)

**빈 상태 문구 before/after**

| 위치 | Before (현재) | After (개선) |
|------|---------------|--------------|
| 관심 상권 없음 | 관심 상권이 없어요 | 아직 찜한 상권이 없어요 |
| 에러 공통 | 데이터를 불러오지 못했어요. 잠시 후 다시 시도해주세요. | 잠깐, 데이터를 가져오다 막혔어요. 새로고침해볼까요? |
| 랜딩 히어로 검색 placeholder | 지역명과 원하는 상권을 입력해 보세요! | 예: 성수동, 홍대, 연남동 |

**subtitle 카피 before/after**

| 위치 | Before | After |
|------|--------|-------|
| RankingPage subtitle | 생존율·유동인구·종합 점수를 기준으로 서울 주요 상권을 한눈에 비교하세요 | 지금 어디가 살아남고 있나요? |
| TrendsPage subtitle | 상권의 분기별 지표 변화와 떠오르는 업종을 한눈에 살펴보세요 | 숫자로 읽는 상권의 오늘과 내일 |
| ComparePage subtitle | 여러 상권을 나란히 비교해 최적의 입지를 찾으세요 | 나란히 놓으면 보이는 것들이 있습니다 |
| LandingPage features h2 | 창업 결정에 필요한 모든 데이터, 한 곳에 | 열기 전에 알아야 할 것들, 여기 있습니다 |

---

### 우선순위 2 — 포인트 컬러 교체 (tokens.css 한 파일만 수정)

현재 `--color-primary: #2447c7`이 Tailwind blue-700 복제에서 겨우 5단계 이동한 수준이다.

```css
/* 현재 */
--color-primary: #2447c7;       /* Tailwind blue-700 복제 */
--color-primary-dark: #1a2f7d;
--color-primary-light: #edf2fc;

/* 제안 A — 딥네이비 코발트 (금융/데이터 신뢰감) */
--color-primary: #1e3a8a;       /* 네이비 계열, 파랑보다 무게감 */
--color-primary-dark: #172554;
--color-primary-light: #eff6ff;

/* 제안 B — 틸-슬레이트 혼합 (상권/지도 앱 느낌) */
--color-primary: #0f5264;       /* 청록과 남색 사이 */
--color-primary-dark: #0a3d4d;
--color-primary-light: #e0f2fe;
```

교체 후 전체 화면에 일괄 반영됨(`var()` 참조로 구성). 단, `AtmosphereSimulation.tsx` 내 하드코딩된 hex 일부는 별도 수정 필요.

---

### 우선순위 3 — 레이아웃 차별화

- **RankingPage**: 단순 세그먼트 컨트롤 + 리스트 대신, 1위~3위를 시각적으로 강조하는 포디엄(podium) 레이아웃 추가. 지금은 1위와 12위의 시각적 무게가 동일.
- **LandingPage Hero**: `radial-gradient + 격자 배경` 대신 실제 서울 상권 지도 이미지를 흐리게 깔거나, 서비스 고유 데이터(예: 실시간 상권 점수 top5)를 hero 배경에 보여주면 "AI 클리셰 랜딩"에서 벗어남.
- **DashboardPage accentBar**: 4px 파란 세로 바 대신 섹션마다 고유 아이콘(유동인구=사람 아이콘, 매출=차트 아이콘, 비용=원화 아이콘)을 사용하면 반복 패턴을 깨면서 스캔 속도도 향상.

---

### 우선순위 4 — OG/메타 설정 (검색·공유 대응)

```html
<!-- index.html에 추가 -->
<meta name="description" content="유동인구·생존율·매출 데이터로 보는 서울 상권 분석 서비스" />
<meta property="og:title" content="상권레이더 — 데이터로 보는 진짜 상권" />
<meta property="og:description" content="창업 전 꼭 확인해야 할 424개 행정동 상권 데이터" />
<meta property="og:image" content="/og-image.png" />
<meta name="twitter:card" content="summary_large_image" />
```

현재 OG 태그 전무. SNS 공유 시 URL 그대로 노출.

---

### 우선순위 5 — 더미 UI 제거 또는 명시적 표시

`ComparePage`의 `+ 상권 추가`, `2026년 1분기 ▾`, `전체 업종 ▾` 버튼이 클릭해도 아무 반응 없음. 이를 `disabled` 처리하거나 `준비 중` 배지를 붙이면 "미완성 AI 결과물" 인상을 줄일 수 있음.

---

## 반론: AI 티가 아닌 것들

균형을 위해 실제로 잘 만들어진 부분도 짚는다.

### 1. 컬러 팔레트의 절제

가장 강한 AI 클리셰인 **보라/인디고 그라데이션, 글래스모피즘, 네온 청록**이 전혀 없다. 스켈레톤 shimmer를 제외하면 그라데이션 자체를 쓰지 않았다. 상권/데이터 서비스로서 신뢰감 있는 컬러 운용을 택한 의식적인 결정이 보인다.

### 2. 데이터 연동의 견고함

`DashboardPage`의 `Promise.allSettled` 12개 병렬 요청, `MyPage`의 compare API 청크 분할 로직(`buildCompareChunks`), alive 플래그 클린업 패턴 등은 실제 백엔드와 씨름하며 다듬어진 코드임이 코드 구조에서 드러난다. 단순 목업이 아닌 실제 API 연동 흔적.

### 3. 접근성 고려

`role="tablist"`, `aria-selected`, `aria-label` 속성이 세그먼트 컨트롤·버튼에 일관되게 적용되어 있다. AI 생성 코드에서 자주 빠지는 부분인데, 여기서는 다수의 대화형 요소에 ARIA 속성이 붙어 있다. `src/pages/RankingPage.tsx:82–90`, `TrendsPage.tsx:140`.
