# 핸드오프 — 상세분석(대시보드) "리포트 저장" 진입점

> 작성일: 2026-07-16 · 작성: 프론트엔드(마이페이지 담당)
> 유형: 스코프 밖 기능 명세(문서만) — **상세분석 화면 담당 팀 처리 요망**
> 상태: **미구현(의도적)**. 아래 명세만 남김.

---

## 왜 이 문서가 있나

마이페이지 **저장된 리포트** 탭(`GET /api/reports`)은 정상 동작하지만,
**리포트를 생성하는 진입점이 앱 어디에도 없어** 목록이 항상 비어 있다.

리포트 생성 버튼의 자연스러운 위치는 **상세분석 화면(대시보드, `src/pages/DashboardPage.tsx`)** 이다.
그런데 이 화면은 **마이페이지 담당(우리) 스코프가 아니라** 별도 담당이 있어,
여기서는 **구현하지 않고 명세만** 남긴다. (담당 팀에서 아래대로 붙이면 마이페이지 저장/공유 탭이 실데이터로 채워진다.)

> 참고: 검증 목적으로 임시 구현했다가 스코프 정리를 위해 되돌렸음.
> 관련 프론트 바인딩(`reportsApi.create`, `ReportCreate`/`ReportCreateOut` 타입)도 함께 제거했으니,
> 담당 팀에서 구현 시 아래 스니펫으로 다시 추가하면 된다.

---

## 백엔드는 이미 준비됨 — `POST /api/reports`

생성 엔드포인트는 **이미 존재**한다(신규 백엔드 작업 불필요). 실측 스키마:

```jsonc
POST /api/reports
{
  "title": "강남역 · 전체 업종 리포트",   // 필수
  "district_name": "강남역",              // 필수
  "category_name": "전체 업종",           // 필수 (업종 미선택 시 "전체 업종" 등으로)
  "memo": null,                           // 선택
  "content": {                            // 필수(객체). 아래 필드는 모두 선택/nullable
    "survival_rate": 97.38,
    "closure_rate": 2.62,
    "open_rate": null,
    "total_business": 5111,
    "peak_start": null,
    "peak_end": null,
    "district_score": 65.77,
    "year_quarter": "2025-Q4",
    "avg_rent_per_sqm": null,
    "avg_population": 7710017.0
  }
}
→ 201 { "id": 47, "title": "...", "created_at": "2026-07-16T..." }
```

`content` 필드는 상세분석의 `activeStats`(상권/업종 지표) 값과 1:1로 대응된다.

---

## 구현 가이드 (담당 팀용)

### 1) 프론트 API 바인딩 복원 — `src/services/reportsApi.ts`

```ts
// types/index.ts 에 추가
export interface ReportCreate {
  title: string;
  district_name: string;
  category_name: string;
  memo?: string | null;
  content: ReportContent; // 이미 존재(공유 조회에서 사용 중)
}
export interface ReportCreateOut { id: number; title: string; created_at: string }

// reportsApi 에 추가
create: (payload: ReportCreate) => apiClient.post<ReportCreateOut>("/api/reports", payload),
```

### 2) 상세분석 헤더에 저장 버튼 — `DashboardPage.tsx`

- 위치: `Header` 컴포넌트(제목/즐겨찾기 옆). CSS 는 **이미 있는 `styles.reportBtn`** 재사용 가능.
- 클릭 시 `activeStats` + `d`(상권 상세)로 payload 구성해 `reportsApi.create` 호출.

```tsx
const label = selCategory ?? "전체 업종";
await reportsApi.create({
  title: `${d.district_name} · ${label} 리포트`,
  district_name: d.district_name,
  category_name: label,
  content: {
    survival_rate: activeStats?.survival_rate ?? null,
    closure_rate: activeStats?.closure_rate ?? null,
    total_business: activeStats?.total_business ?? null,
    district_score: activeStats?.district_score ?? null,
    year_quarter: activeStats?.year_quarter ?? null,
    avg_population: d.avg_population ?? null,
  },
});
```

### 3) 저장 성공 후 캐시 무효화 (마이페이지 즉시 반영)

```ts
queryClient.invalidateQueries({ queryKey: ["me", "reports"] }); // useMyReports
queryClient.invalidateQueries({ queryKey: queryKeys.myStats });  // 저장 리포트 카운트
```

### 4) 피드백

- 공통 토스트 컴포넌트 `src/components/common/Toast.tsx`(`useToast`) 재사용 권장.
  예: "리포트를 저장했어요. 마이페이지에서 확인할 수 있어요."

---

## 마이페이지 측 상태 (우리 스코프, 이미 완료)

- **저장된 리포트**: `GET /api/reports` 목록 표시 + 공유/삭제 버튼 연결 완료.
- **공유된 리포트**: 공유 시 받은 토큰을 localStorage 로 추적해 탭에 노출, 공유 링크 뷰(`/reports/share/:token`)도 구현 완료.
- 위 저장 진입점만 담당 팀에서 붙이면 저장→공유 전 흐름이 실데이터로 완결된다.

## 체크리스트 (상세분석 담당 팀)

- [ ] `reportsApi.create` + 타입 복원
- [ ] 상세분석 헤더에 "리포트 저장" 버튼(`styles.reportBtn`) 추가
- [ ] 저장 성공 시 `["me","reports"]` / `myStats` 무효화
- [ ] 저장 피드백 토스트
