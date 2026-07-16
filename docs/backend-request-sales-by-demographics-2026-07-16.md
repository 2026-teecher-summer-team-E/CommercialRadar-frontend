# 백엔드 요청 — 연령·성별 **매출** 데이터 제공

> 작성일: 2026-07-16 · 작성: 프론트엔드(대시보드 연령·성별 카드)
> 유형: 신규 데이터/엔드포인트 요청
> 확인 환경: 백엔드 `localhost:8000`

---

## 배경 — "연령·성별 매출" 카드가 실제로는 유동인구를 그리고 있다

대시보드의 **연령·성별 매출 카드**(`AgeGenderCard`)는 제목이 "연령·성별 매출"이지만,
현재 그리는 값은 **매출이 아니라 유동인구(population) 분포**다. 매출 breakdown 소스가
없어서 부득이 유동인구를 끌어다 쓰고 있다.

```
연령·성별 매출          ← 제목은 "매출"
  최다 · 30대 24% · 성별 분리
  10대 ▮▮ 8%
  20대 ▮▮▮▮ 19%
  30대 ▮▮▮▮▮ 24%   ← 값의 출처는 유동인구
  ...
  [여성] [남성]        ← 성별 토글도 실제 성별매출이 아닌 추정
```

프론트 코드에도 이 한계가 주석으로 남아 있다 (`src/pages/DashboardPage.tsx:432`):

```
// 연령 분포(실데이터, dimension="age"). 성별 marginal 은 {남성:총,여성:총} 총량뿐이라
// 연령×성별 세부는 DB 에 없다. 연령 막대는 성별 비율로 스케일해 토글을 표현한다.
```

즉 지금 성별 토글 값은 **연령별 유동인구 × 성별 유동인구 비율**로 만든 근사치이며,
실제 "성별 매출"이 아니다.

---

## 현재 가진 데이터로는 불가능한 이유

프론트가 쓰는 소스는 `GET /api/commercial-districts/{id}/time-series` 하나뿐이고,
여기서 매출은 **분기 총액 스칼라 하나**로만 온다. 연령/성별 breakdown 은 `population` 에만 있다.

| 응답 필드 | 타입 | 연령·성별 매출 산출 가능? |
|-----------|------|--------------------------|
| `data[].sales` | `number \| null` (분기 총매출) | ❌ 총액뿐, breakdown 없음 |
| `data[].population.total` | `number \| null` | — |
| `data[].population.breakdown` | `Record<string, Record<string, number>>` (연령/성별) | △ **유동인구** breakdown만 존재 |

현재 호출 (`DashboardPage.tsx:180-181`):

```ts
commercialApi.timeSeries(id, { metrics: "population", breakdown: "age" })    // 연령 유동인구
commercialApi.timeSeries(id, { metrics: "population", breakdown: "gender" }) // 성별 유동인구
```

→ 매출 breakdown 이 어디에도 없어, 제목만 "매출"이고 값은 유동인구다.

참고로 **주·야간 매출 비중** 카드는 이미 전용 엔드포인트
(`GET /api/commercial-districts/{id}/sales-time-bands`)로 **실제 매출**을 받아 정상 동작한다.
연령·성별 매출도 동일한 방식으로 전용 엔드포인트를 하나 열어주면 해결된다.

---

## 요청 사항

상권의 **연령대별 / 성별 매출**을 제공해주세요. 서울 상권분석 원천 데이터에
`매출_연령대별`·`매출_성별` 컬럼이 존재하므로 데이터 자체는 있는 것으로 파악됩니다.
아래 둘 중 편한 방식이면 됩니다. **(A) 권장.**

### (A) 전용 엔드포인트 신설 (권장 — sales-time-bands 와 동일 패턴)

```
GET /api/commercial-districts/{id}/sales-by-demographics
```

```jsonc
{
  "district_id": 1315,
  "year_quarter": "2025-Q4",
  "age": {                 // 연령대별 매출액(원). 라벨은 아래 표기 규칙 참고
    "10대": 120000000,
    "20대": 830000000,
    "30대": 1020000000,
    "40대": 760000000,
    "50대": 540000000,
    "60대이상": 310000000
  },
  "gender": {              // 성별 매출액(원)
    "남성": 2100000000,
    "여성": 1480000000
  },
  "age_by_gender": {       // (선택) 연령×성별 교차. 있으면 성별 토글이 진짜 데이터가 됨
    "남성": { "10대": 60000000, "20대": 480000000, "...": 0 },
    "여성": { "10대": 60000000, "20대": 350000000, "...": 0 }
  }
}
```

- `age_by_gender` 교차가 **원천에 있으면** 함께 주세요. 그러면 프론트의 "여성/남성" 토글이
  근사치가 아니라 실제 성별×연령 매출로 바뀝니다.
- 교차가 없으면 `age` + `gender` marginal 두 개만으로도 지금 구조를 매출로 교체할 수 있습니다
  (현재 유동인구로 하던 스케일 로직을 그대로 매출에 적용).

### (B) time-series 의 sales 지표에 breakdown 추가

기존 `time-series` 를 확장해 매출도 population 처럼 breakdown 을 지원:

```
GET /api/commercial-districts/{id}/time-series?metrics=sales&breakdown=age
GET /api/commercial-districts/{id}/time-series?metrics=sales&breakdown=gender
```

응답의 `data[].sales` 를 스칼라 대신 population 과 같은 `{ total, breakdown }` 형태로:

```jsonc
"sales": { "total": 3580000000, "breakdown": { "age": { "20대": 830000000, ... } } }
```

⚠️ (B)는 기존 `sales: number` 소비처(예: 매출 추이 라인차트 `DashboardPage.tsx:417`)의
타입이 바뀌므로 회귀 범위가 넓습니다. **가급적 (A)를 권장**합니다.

---

## 표기 규칙 — 라벨 합의

프론트는 아래 라벨을 그대로 매핑합니다 (`AgeGenderCard.tsx`). 키를 맞춰주시면 변환 불필요:

- 연령: `"10대" | "20대" | "30대" | "40대" | "50대" | "60대이상"`
- 성별: `"남성" | "여성"`
- 매출 단위: **원**(정수). 다른 단위(천원 등)면 응답 어딘가에 단위 명시 부탁드립니다.

---

## 제공 후 프론트 작업(참고)

1. `fetchDashboard` 에 `sales-by-demographics` 호출 추가(`Promise.allSettled` 병렬 슬롯).
2. `femaleDist`/`maleDist` 를 유동인구 스케일 대신 **매출 응답**으로 교체
   (`DashboardPage.tsx:454-463`).
3. `AgeGenderCard` 제목 "연령·성별 매출" 이 비로소 데이터와 일치.
4. 데이터 없는 상권은 기존대로 "데이터 없음" 처리.

---

## 요청 체크리스트

- [ ] 제공 방식 결정: (A) `sales-by-demographics` 엔드포인트 / (B) time-series sales breakdown
- [ ] `age_by_gender` 교차 매출 제공 가능 여부 확인(가능하면 성별 토글 정확도↑)
- [ ] 라벨 키(`10대`~`60대이상`, `남성`/`여성`) 및 매출 단위(원) 합의
- [ ] 제공 후 프론트에서 강남역(1315) 기준 연령·성별 매출 표기 회귀 확인
