# 지역분석 업종(카테고리) 필터 — 구현 가이드

> 작성일: 2026-07-12 · 대상: 지역분석/지도(MapPage)에 직방 스타일 필터바 + 업종 드롭다운 추가
> 검증: 백엔드 `http://localhost:8000` 실응답(curl)로 확인

## 1. 결론

**업종별 필터, 가능합니다.** 백엔드가 데이터 레벨에서 `category_name` 쿼리 파라미터를 지원합니다.
단, **지도 마커의 "위치"는 업종과 무관**하고(모든 상권 좌표는 고정), 업종을 고르면 **각 상권의 "데이터"(점수·생존율·폐업률·매출·예측)가 그 업종 기준으로 재계산**됩니다.

## 2. 백엔드 지원 현황

| 엔드포인트 | `category_name` 지원 | 반환(업종 기준) |
|---|---|---|
| `GET /api/commercial-districts/compare?district_ids=..&category_name=..` | ✅ | 상권별 district_score·survival_rate·closure_rate (업종별) |
| `GET /api/commercial-districts/{id}/category-ranking` | ✅ (상권 내 업종 순위) | 업종별 점수·생존율·사업체수 top 10 |
| `GET /api/commercial-districts/{id}/survival-forecast?category_name=..` | ✅ | 업종 전용 ML 생존 예측(model 도 `tft-cafe-v0.1` 등으로 바뀜) |
| `GET /api/commercial-districts/{id}/time-series?metrics=sales&category_name=..` | ✅ | 업종별 분기 매출 시계열 |
| `GET /api/commercial-districts/geo?category_name=..` | ⚠️ 무시됨 | 마커 1650개 동일(위치는 업종 무관) |

> 한글 카테고리는 URL 인코딩 필요(`커피-음료` → `%EC%BB%A4%ED%94%BC-%EC%9D%8C%EB%A3%8C`). axios `params`로 넘기면 자동 인코딩됨.

## 3. 데이터 동작 — 실제 예시

`compare?district_ids=1315,1288&category_name=커피-음료` 실응답:

| 상권 | 전체 업종 점수 | 커피-음료 점수 | 커피-음료 생존율 | 폐업률 |
|---|---|---|---|---|
| 강남역(1315) | 65.8 | **82.4** | 98% | 2% |
| 잠실새내역(1288) | 65.6 | **78.0** | **86%** | 14% |

→ 업종을 바꾸면 상권 점수·생존율이 실제로 달라집니다(잠실새내 커피는 생존율 86%로 하락). 필터가 "장식"이 아니라 실데이터로 동작.

## 4. 프론트 통합 지점

### 현재 MapPage 데이터 흐름 (`src/pages/MapPage.tsx`)
- `commercialApi.geo()` → 지도 마커(`DistrictGeo[]`) — **업종 무관, 그대로 사용**
- `commercialApi.geojson()` → 상권 폴리곤 — 그대로
- `commercialApi.getDistrict(selectedId)` → 선택 상권 요약(`SangkwonPanel`에 표시) — **여기가 업종 반영 대상**

### 이미 준비된 서비스 (`src/services/commercialApi.ts`)
`compare`·`categoryRanking`·`timeSeries` 는 **이미 `category_name` 파라미터를 받도록 구현돼 있음**:
```ts
compare: (ids, params?: { year_quarter?: string; category_name?: string }) => ...
categoryRanking: (id, params?) => ...   // params 에 category_name 실어보내면 됨
timeSeries: (id, params?) => ...        // { metrics: "sales", category_name }
```
`survival-forecast` 는 `mlApi.survivalForecast(id, params)` 가 `params`를 받으므로 `{ category_name }` 전달 가능.

### 필요한 작업
1. **필터 상태 추가**: MapPage 에 `const [category, setCategory] = useState<string | null>(null)` (null = 전체 업종).
2. **필터바 UI**: 검색창 아래 직방 스타일 pill 드롭다운(`업종 ▾`). 선택 시 `setCategory`.
3. **선택 상권 요약을 업종 반영**: `getDistrict(id)` 는 category 를 안 받으므로, 업종 선택 시 점수/생존율은 `compare([id], { category_name })` 또는 `categoryRanking(id)` 결과에서 해당 업종 행을 뽑아 패널에 표시.
4. (선택) 지도 마커 색/점수도 업종 기준으로 칠하려면, 화면에 보이는 상권 id들을 `compare(ids, { category_name })` 로 5개씩 묶어 조회(‼️ compare 는 2~5개만 허용 — RankingPage 청크 로직 참고).

## 5. 업종 드롭다운 목록 소스

전용 "업종 리스트" 엔드포인트는 **없음**(`/api/categories` 404, `/api/commercial-districts/categories` 422). 3가지 선택지:

- **(A) 프론트 상수 세트** — 가장 간단. 서울시 상권분석 표준 업종을 상수 배열로. 아래 §6 스타터 리스트 사용.
- **(B) category-ranking 수집** — 여러 상권의 `category-ranking` 을 합쳐 유니버스 구성(각 상권 top 10만 주므로 다수 상권 조회 필요, 비효율).
- **(C) 백엔드에 목록 API 요청** — `GET /api/categories` 신설 요청(가장 깔끔). 권장.

## 6. 업종 스타터 리스트 (17개 상권 top10 합집합, 52종)

전용 API 전까지 상수로 쓸 수 있는 실측 업종 목록(등장 빈도순):

```
한식음식점, 일반의류, 의약품, 커피-음료, 미용실, 일반의원, 호프-간이주점, 제과점,
치과의원, 서적, 편의점, 양식음식점, 슈퍼마켓, 가방, 일반교습학원, 완구, 스포츠 강습,
청과상, 여관, 일식음식점, 화초, 한의원, 화장품, 육류판매, 시계및귀금속, 가전제품,
안경, 세탁소, 전자상거래업, 미곡판매, 신발, 사진관, 예술품, 예술학원, 분식전문점,
복권방, 패스트푸드점, 조명용품, 가전제품수리, 당구장, 치킨전문점, 악기, 반찬가게,
섬유제품, 인테리어, 가구, 피부관리실, 독서실, 의료기기, 자동차수리,
컴퓨터및주변장치판매, 노래방
```
> ⚠️ 이건 17개 상권 top10만 모은 샘플이라 전체 업종을 다 담지 못할 수 있음. 정확한 전체 목록은 (C) 백엔드 API 가 최선.

## 7. 구현 체크리스트

- [ ] MapPage 에 `category` 상태 + 필터바 UI 추가
- [ ] 업종 드롭다운 목록 소스 결정(A/B/C)
- [ ] 선택 상권 패널 점수/생존율을 `category_name` 반영해 조회·표시
- [ ] (선택) 지도 마커 색/랭킹을 업종 기준으로 재계산(compare 2~5개 청크)
- [ ] "전체 업종" 옵션(=category null) 처리
- [ ] 업종별 데이터 없는 상권 fallback UX(빈 상권은 해당 업종 사업체 0 → "데이터 없음")

## 8. 주의사항

- `compare` 는 한 번에 **2~5개** 상권만 허용(1개·6개 이상 400). 여러 상권을 업종 기준으로 칠하려면 5개씩 청크(기존 `RankingPage.tsx:47-51` 패턴 재사용, 단 마지막 청크 1개 방지).
- 한글 카테고리는 URL 인코딩 필수(axios `params` 사용 시 자동).
- 마커 위치는 업종 무관 — "업종 필터 = 마커가 사라진다"가 아니라 "각 상권 값이 그 업종 기준으로 바뀐다"임을 UX 에서 명확히.
