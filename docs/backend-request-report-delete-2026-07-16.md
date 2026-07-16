# 백엔드 요청 — 리포트 삭제(DELETE) 엔드포인트 신설

> 작성일: 2026-07-16 · 작성: 프론트엔드(마이페이지)
> 유형: 신규 엔드포인트 요청
> 확인 환경: 백엔드 `localhost:8000` (가동 확인)

---

## 배경 — "삭제" 버튼이 실제로는 동작하지 않는다

마이페이지 **저장된 리포트** 탭의 각 카드에는 삭제(휴지통) 버튼이 있고,
프론트는 `DELETE /api/reports/{id}` 를 호출하도록 이미 구현되어 있다
(`src/services/reportsApi.ts` 의 `remove`, `src/pages/MyPage.tsx` 의 `handleRemove`).

하지만 현재 백엔드에 **해당 DELETE 라우트가 없어** 요청이 `405 Method Not Allowed` 로 실패한다.
프론트는 낙관적(optimistic) 제거 후 실패 시 롤백하도록 되어 있어, **삭제 버튼을 눌러도 카드가 잠깐 사라졌다가 다시 나타난다.**

### 근거 (OpenAPI 실측, 2026-07-16)

```
/api/reports                       -> GET, POST
/api/reports/{report_id}           -> GET            ← DELETE 없음
/api/reports/{report_id}/share     -> POST
/api/reports/share/{share_token}   -> GET
/api/reports/{report_id}/export    -> GET
```

```bash
$ curl -s -o /dev/null -w "%{http_code}" -X DELETE http://localhost:8000/api/reports/46
405
```

---

## 요청 사항

`DELETE /api/reports/{report_id}` 를 신설해 주세요.

```
DELETE /api/reports/{report_id}
→ 204 No Content   (또는 200 { "ok": true })
```

### 기대 동작
- 요청자 **본인 소유 리포트**만 삭제 가능(타인 리포트는 `403`/`404`).
- 존재하지 않는 id → `404`.
- 삭제 성공 시 `GET /api/users/me/stats` 의 `saved_reports` 카운트도 함께 감소.
- 소프트 삭제/하드 삭제 여부는 백엔드 판단에 맡김. (프론트는 목록에서 제거만 하면 됨)

### 공유된 리포트와의 관계 (확인 요청)
- 이미 공유(`/share`)된 리포트를 삭제하면, 기존 공유 링크(`GET /api/reports/share/{token}`)는
  **404 로 만료**되는 것이 자연스럽습니다. 이 동작이 맞는지 확인 부탁드립니다.
  (프론트 공유 탭은 localStorage 로 별도 추적 중이라, 링크가 만료되면 "찾을 수 없음" 화면을 정상 표시합니다.)

---

## 프론트 상태 (백엔드 반영 시 추가 작업 불필요)

- `reportsApi.remove` / `MyPage.handleRemove` 는 **이미 DELETE 를 호출**하도록 구현되어 있음.
- 백엔드에 라우트가 생기면 별도 프론트 수정 없이 즉시 정상 동작(낙관적 제거가 확정됨).

## 요청 체크리스트

- [ ] `DELETE /api/reports/{report_id}` 신설 (본인 소유만)
- [ ] 삭제 시 `saved_reports` 통계 감소
- [ ] 공유된 리포트 삭제 시 공유 링크 만료 동작 확인
