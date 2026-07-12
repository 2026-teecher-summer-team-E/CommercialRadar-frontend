# CommercialRadar 프론트엔드 문제점 감사

> 작성일: 2026-07-12
> 리뷰 방식:
> - **Opus** — 로직·데이터·버그 (백엔드 `localhost:8000` 실응답 대조)
> - **Sonnet** — UX·접근성·일관성 (백엔드 `localhost:8000` 실응답 대조)

---

## 요약 통계

| 심각도 | Opus (로직) | Sonnet (UX) | 합산 (중복 병합 후) |
|--------|------------|-------------|-------------------|
| 🔴 High | 3 | 13 | 14 |
| 🟡 Medium | 5 | 12 | 16 |
| 🟢 Low | 4 | 5 | 8 |
| **합계** | **12** | **30** | **38** |

> 중복 병합: 하드코딩 28.4% 문구(`StatCards.tsx:152`)는 양쪽에서 지적되어 1건으로 처리.

---

## 🔴 High

### H-01 · `src/pages/TrendsPage.tsx:19-25` — DISTRICT_OPTIONS 하드코딩 id↔이름 불일치

**문제** DISTRICT_OPTIONS가 `{id:1,"역삼역"},{id:2,"강남역"},{id:3,"홍대입구역"}`로 고정되어 있으나 백엔드 실응답은 `id=1→"황학동벼룩시장"`, `id=2→"배화여자대학교"`, `id=3→"자하문터널"`. 사용자가 "강남역"을 선택하면 실제로는 배화여대 데이터가 로드되고 제목에는 "강남역"이 표시됨.

**권장 수정** 상권 목록 API를 동적 로드하거나 실제 id↔이름 매핑으로 교체.

---

### H-02 · `src/pages/RankingPage.tsx:8` — DISTRICT_IDS 하드코딩으로 랭킹 의미 훼손

**문제** `DISTRICT_IDS=[1..12]` 하드코딩으로 "서울 주요 상권 랭킹"이 임의의 12개 시드 상권(황학동벼룩시장·배화여대·자하문터널 등)을 나열. 실제 상권 id는 1~1650이며 `district_score`도 시드마다 null 가능해 종합점수 정렬이 무의미함.

**권장 수정** top-N 랭킹 API 요청 또는 실제 대표 상권 id 목록으로 교체.

---

### H-03 · `src/pages/RankingPage.tsx:47-51` — compare API 청크 분할 엣지케이스 실패

**문제** compare API는 2~5개만 허용(1개=400, 6개=400 실측). 현재 12개를 `[5,5,2]`로 분할해 안전하나, id 개수가 11/6개가 되면 마지막 청크 1개→400→`Promise.all` 전체 reject→랭킹 전체 "불러오지 못했어요" 침묵 실패.

**권장 수정** 마지막 청크를 앞 청크에 병합하거나 `Promise.allSettled`로 성공 청크만 병합.

---

### H-04 · `src/pages/DashboardPage.tsx:442, 498` — "상세 리포트 생성" 버튼 미동작 (죽은 UI)

**문제** "상세 리포트 생성" 버튼 2개 모두 `onClick` 없음.

**권장 수정** 핸들러 연결 또는 `disabled` + 준비 중 표시로 변경. 두 버튼을 하나로 통합 후 구현 권장.

---

### H-05 · `src/pages/ComparePage.tsx:139,144,149,152` — 상권 제거·추가·분기·업종 버튼 4개 미동작

**문제** 상권 제거(×)·상권 추가·분기 선택·업종 선택 버튼 4개 모두 `onClick` 없음.

**권장 수정** 핸들러 구현 또는 placeholder 명시.

---

### H-06 · `src/components/dashboard/ScoreCard.tsx:95` — "산출 근거 보기 ›" 비대화형 span

**문제** "산출 근거 보기 ›"가 `span`으로 렌더되어 클릭·키보드·스크린리더 접근 불가.

**권장 수정** `button` 또는 `a` 태그로 변경 후 핸들러 추가.

---

### H-07 · `src/components/layout/Sidebar.tsx:81` — nav에 aria-label 없음

**문제** 프로젝트 전체 aria 속성이 0개 수준이며 nav에 aria-label이 없음.

**권장 수정** `aria-label="메인 네비게이션"` 추가.

---

### H-08 · `src/components/charts/AtmosphereSimulation.tsx:124` — 오버레이 모달 ARIA 전무

**문제** 오버레이 모달에 `role="dialog"` / `aria-modal` / `aria-label`이 없음. 닫기 버튼(✕)에도 `aria-label` 없음.

**권장 수정** `role="dialog" aria-modal="true" aria-label="..."` 추가. 닫기 버튼에 `aria-label="닫기"` 추가.

---

### H-09 · `src/components/dashboard/ExpandModal.tsx:14`, `src/components/compare/ExpandModal.tsx:14` — 모달 focus trap 없음

**문제** Escape만 처리하며 focus trap 없음. 열릴 때 포커스 이동도 미구현.

**권장 수정** 열릴 때 포커스 이동, `inert` 또는 `focus-trap` 라이브러리 적용.

---

### H-10 · `src/components/dashboard/StatCards.tsx:74,76` — ForeignCard "지표없음" 상시 노출 ¹

**문제** pct 값이 있어도 "지표없음"(장식 막대 자리)·"서울 평균 지표없음"이 항상 표시됨. "서울 평균 지표없음" 문구는 의미가 모호("서울 평균이 지표없음"? "지표: 서울 평균 없음"?).

**권장 수정** "서울 평균 데이터 준비 중" 등 구체적 문구로 개선.

---

### H-11 · `src/components/dashboard/ScoreCard.tsx:66` — "순위 지표없음" 무조건 렌더 ¹

**문제** 순위 데이터 유무와 관계없이 "순위 지표없음"이 항상 렌더됨.

**권장 수정** 데이터가 없을 때만 노출하는 조건부 렌더 또는 표시 방식 개선.

---

### H-12 · `src/components/dashboard/ScoreCard.tsx:120` — "피크 지표없음" 무조건 렌더 ¹

**문제** "피크 지표없음"이 항상 렌더되며 "피크"가 무엇인지 불명확.

**권장 수정** "최고 매출 시간대 데이터 없음" 등으로 구체화하거나 데이터 없을 때만 표시.

---

### H-13 · `src/components/dashboard/SurvivalCard.tsx:80` — ForecastChart width 고정 (모바일 넘침)

**문제** `width={560}` 고정으로 모바일에서 넘침.

**권장 수정** `width="100%"` + `viewBox` 반응형 처리.

---

### H-14 · `src/pages/ComparePage.tsx:228` — LineChartSvg width 고정

**문제** `width={760}` 고정.

**권장 수정** 반응형 처리.

---

### H-15 · `src/components/charts/AtmosphereSimulation.tsx:124` — 인라인 style width 고정

**문제** `style="width:560px"` 고정으로 미디어쿼리 적용 불가.

**권장 수정** CSS 모듈로 분리 후 `min(560px, 100% - 32px)` 적용.

---

## 🟡 Medium

### M-01 · `src/pages/DashboardPage.tsx:143-146` — 비숫자 districtCode 조용한 폴백

**문제** `/dashboard/abc` 등 비숫자 경로를 조용히 `id=1`(황학동벼룩시장)으로 폴백. 백엔드는 404를 정상 반환하므로 에러 처리 가능. 존재하지 않는 숫자 id는 에러 처리되는데 비숫자만 조용히 폴백되는 비대칭.

**권장 수정** 폴백 제거, 유효하지 않으면 에러/404 페이지로 이동.

---

### M-02 · `src/components/dashboard/StatCards.tsx:133, 152` — 주말 판정 임계값·문구 불일치 및 하드코딩 벤치마크

**문제** 주말 판정 임계값(`28.6`)과 안내 문구("전체 상권 평균 28.4%")가 서로 다른 매직넘버. `pct=28.5`면 평균 초과인데 "주중 우위"로 표시되는 모순. 또한 "전체 상권 평균 28.4%"는 어떤 API에도 존재하지 않는 하드코딩 벤치마크.

**권장 수정** 상수 하나로 통일, 이상적으로는 서버 제공 평균 사용.

---

### M-03 · `src/pages/DashboardPage.tsx:283-287, 431-437` — buzz-gap 상권명 문자열 매칭

**문제** buzz-gap을 상권명 문자열 정확일치로 매칭. buzz-gap은 59개 상권만 포함해 대다수 상권에서 카드가 항상 "지표없음". 표기가 조금만 달라도 매칭 실패.

**권장 수정** id 기반 매칭 API 전환 또는 fallback UX 명시.

---

### M-04 · `src/components/dashboard/StatCards.tsx:63,89,124` — ⓘ 비대화형 텍스트

**문제** 제목의 ⓘ가 일반 텍스트로 렌더되어 tooltip·클릭 없음.

**권장 수정** 클릭 가능한 `button`으로 분리하거나 `title` 속성 추가.

---

### M-05 · `src/pages/MyPage.tsx:190` — tablist aria-label 없음

**문제** tablist에 `aria-label` 없음(다른 페이지에는 있음).

**권장 수정** `aria-label="콘텐츠 유형"` 추가.

---

### M-06 · `src/components/dashboard/ScoreCard.tsx:106` — 폐업위험 도트 색만으로 의미 전달

**문제** 폐업위험 도트가 색만으로 의미를 전달하며, 빈 `i` 태그를 스크린리더가 읽음.

**권장 수정** `aria-hidden="true"` 추가 및 아이콘 차별화.

---

### M-07 · `src/components/map/SangkwonPanel.tsx:67,91,121` — aria-hidden 값 미명시

**문제** `aria-hidden` 값 없는 불리언 형태 사용(동작은 하나 일관성 부족).

**권장 수정** `aria-hidden="true"` 명시.

---

### M-08 · 빈 상태 문구 4패턴 혼용

**문제** "지표없음"(`StatCards:51,74`, `ScoreCard:79,120`) vs "데이터가 없어요."(`AgeGenderCard:60`, `PopulationHeatmap:64`, `SurvivalCard:90`) vs "불러오지 못했어요..."(`RankingPage:108`, `ComparePage:123`) vs "—"가 혼용됨.

**권장 수정** 수치 자리="—", 카드 빈 상태="데이터가 없어요", 네트워크 에러="불러오지 못했어요" 3계층으로 통일.

---

### M-09 · `src/pages/MapPage.tsx:219` — 로딩 표시 패턴 불일치

**문제** 로딩을 패널 내부 텍스트로만 표시. 다른 페이지는 페이지 스켈레톤 사용.

**권장 수정** 스켈레톤 패턴으로 통일.

---

### M-10 · `src/components/dashboard/ScoreCard.tsx:120` — "피크 지표없음" 문구 불명

**문제** "피크 지표없음"에서 "피크"가 무엇인지 불명확.

**권장 수정** "최고 매출 시간대 데이터 없음" 등으로 구체화.

---

### M-11 · `src/components/dashboard/StatCards.tsx:133` — null일 때도 "주중 우위" 태그 렌더

**문제** `pct==null`일 때도 "주중 우위" 태그가 렌더됨(데이터 없는데 단정).

**권장 수정** null이면 태그 숨김.

---

### M-12 · `src/pages/ComparePage.tsx:149,152` — 고정 플레이스홀더 + 클릭 불가

**문제** "2026년 1분기 ▾", "전체 업종 ▾" 고정 플레이스홀더로 표시되며 클릭 불가.

**권장 수정** 실데이터 연결 또는 비활성화.

---

### M-13 · `src/components/layout/Sidebar.module.css:2` — Sidebar width 고정, 반응형 없음

**문제** `width:236px` 고정이며 미디어쿼리 전무.

**권장 수정** 768px 이하 햄버거 메뉴 또는 숨김 처리.

---

### M-14 · `src/pages/DashboardPage.module.css:129,141,153` — 미디어쿼리 분기 부족

**문제** 미디어쿼리 980px 하나뿐, 480px 분기 없음.

**권장 수정** 480px 분기 추가.

---

### M-15 · `src/pages/DashboardPage.tsx` vs 페이지 간 내비게이션 이원화

**문제** LandingHeader와 Sidebar의 내비게이션 패턴이 이원화되어 있고 브랜드 표기가 불일치.

**권장 수정** 내비게이션 패턴 통일 및 브랜드 표기 일관화.

---

### M-16 · `ExpandModal` 2곳:29 — aria-label 패턴

**문제** `aria-label={title}` 사용보다 `id` + `aria-labelledby` 패턴이 권장됨.

**권장 수정** `id` + `aria-labelledby` 패턴으로 변경.

---

## 🟢 Low

### L-01 · `src/services/forecastApi.ts:3` — apiClient 미재사용 및 인증 인터셉터 미적용

**문제** `baseURL`에 `?? ""` 폴백 없음. 별도 axios 인스턴스 중복 생성으로 인증 인터셉터도 미적용.

**권장 수정** 공용 `apiClient` 재사용.

---

### L-02 · `src/services/forecastApi.ts:6-8` — 죽은 스텁 3개

**문제** `/api/forecast/*` 3개 엔드포인트는 백엔드 404 실측.

**권장 수정** 제거.

---

### L-03 · `src/pages/MyPage.tsx:78-86` — 공유(handleShare) 결과 침묵

**문제** 공유 실패 시 완전 침묵, 성공 시 UI 갱신 없음.

**권장 수정** 토스트 또는 상태 갱신 추가.

---

### L-04 · `src/pages/AdminPage.tsx:7-17` — 헬스체크 없는 고정 상태 카드

**문제** STATUS_CARDS("API 상태:정상","데이터베이스:연결됨")가 실제 헬스체크 없는 고정 문자열. 장애 시에도 "정상" 표시.

**권장 수정** `/health` 실호출 또는 "데모" 라벨 표기.

---

### L-05 · `src/pages/MyPage.tsx:108` — 로딩 표시 패턴 불일치

**문제** "불러오는 중…" 텍스트 표시. 다른 페이지는 스켈레톤 사용.

**권장 수정** 스켈레톤으로 통일.

---

### L-06 · `src/pages/RankingPage.tsx:51` — tr에 role="link" 유효하지 않은 ARIA 조합

**문제** `tr`에 `role="link"`는 유효하지 않은 ARIA 조합.

**권장 수정** `role` 제거 또는 내부 `a` 태그 패턴 사용.

---

### L-07 · `src/components/dashboard/BuzzGapCard.tsx:56` — "거품 주의" 맥락 모호

**문제** "거품 주의" 레이블의 의미가 불명확.

**권장 수정** "SNS 화제성 대비 실제 소비가 낮아 과대평가 주의" 등으로 구체화.

---

### L-08 · `src/pages/GangnamCafeDemoPage.tsx` — 데모 페이지 프로덕션 라우트 잔존

**문제** 데모 페이지가 프로덕션 라우터에 잔존.

**권장 수정** 라우터에서 제거 또는 dev 환경 가드 추가.

---

### L-09 · `src/components/dashboard/RentCard.tsx:47` — key에 label+index 조합

**문제** `key`에 `label+index` 조합 사용.

**권장 수정** 고유 id 사용.

---

## ⚠️ 유보 (저확신)

### Q-01 · `src/pages/DashboardPage.tsx:233` — 예측 차트 앵커 포인트 정규화 미적용

**문제** 예측 차트 앵커 포인트에 `toPct` 미적용. 현재 `latest_stats`는 항상 0~100이라 무해하나, `survival_rate≤1`인 상권이 오면 앵커 0.5 vs 예측 50으로 차트가 튀는 잠재적 버그.

**권장 수정** 앵커도 정규화 함수로 일원화.

---

### Q-02 · `src/lib/apiClient.ts:19-29` — 401/403 인터셉터 부재

**문제** 401/403 응답 인터셉터 없음. 토큰 만료 시 자동 처리 미구현. Clerk 세션 갱신 방식에 따라 문제가 아닐 수 있어 유보.

**권장 수정** Clerk 세션 갱신 방식 확인 후 필요 시 인터셉터 추가.

---

## ✅ 잘한 점

- 모든 데이터 로딩 `useEffect`에 `alive`/`cancelled` cleanup 플래그 일관 적용 (unmount race 방지)
- `DashboardPage`의 `Promise.allSettled` + `pick()` 헬퍼로 개별 카드 실패 격리, 핵심(`district`)만 전체 에러 처리
- `MyPage handleRemove`의 낙관적 제거 + 실패 롤백 패턴 정확
- `survival_rate` 스케일 이중성(0~1 vs 0~100)을 `toPct` 가드+주석으로 명시 처리
- 임대료 단위(천원/㎡→×1000) 주석과 함께 일관 적용

---

## 비고

아래 3건은 **2026-07-12 결정에 따라 의도된 동작**이다. 백엔드에 해당 데이터가 존재하지 않아 상시 "지표없음"으로 표기되는 것이 현 시점의 정상 동작이나, 문구·표시 방식 개선 여지가 있다.

| # | 위치 | 현재 표기 | 개선 여지 |
|---|------|-----------|----------|
| ¹ | `ScoreCard.tsx:66` (H-11) | "순위 지표없음" 무조건 렌더 | 준비 중 상태임을 명확히 전달하는 문구로 개선 |
| ¹ | `ScoreCard.tsx:120` (H-12) | "피크 지표없음" 무조건 렌더 | "최고 매출 시간대 데이터 준비 중" 등으로 구체화 |
| ¹ | `StatCards.tsx:74,76` (H-10) | "지표없음" / "서울 평균 지표없음" 상시 노출 | "서울 평균 데이터 준비 중" 등 명확한 문구로 개선 |

> ¹ H-10, H-11, H-12 항목은 이 비고를 참조.
