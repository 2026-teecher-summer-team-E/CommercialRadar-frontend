# [백엔드 요청] 관심 상권 메모 수정 API 추가

## 배경
마이페이지에서 **즐겨찾기(관심 상권)마다 메모를 추가/수정**할 수 있게 하려고 합니다.
현재 관심 상권 API는 `GET / POST / DELETE`만 있어, **이미 등록된 관심 상권의 메모를 바꿀 방법이 없습니다.**
메모 수정용 엔드포인트 하나만 추가해 주시면 프론트에서 UI를 붙이겠습니다.

> 참고: 모델(`interest_district`)에 `memo` 컬럼과 `updated_at`(onupdate)이 이미 있어, 컬럼/마이그레이션 추가는 필요 없습니다.

---

## 요청 사항: `PATCH /api/interest-districts/{interest_district_id}`

등록된 관심 상권의 `memo`를 수정합니다. (**`category_name`은 수정 대상 아님 — 수정 불가**)

### 인증
- 기존과 동일하게 **Clerk JWT 필요** (`get_current_user`).
- **본인 소유** 관심 상권만 수정 가능. 남의 것/없는 것 → `404`.

### Request Body
```json
{
  "memo": "임대료 재확인 필요"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `memo` | `string \| null` | 필수 | 메모 내용. `null` 또는 `""` 이면 메모 삭제(비우기)로 처리. |

- **`memo`만 수정 가능.** `category_name` 등 다른 필드는 요청에 오더라도 무시(수정 불가).
- (권장) `memo` 길이 제한 예: 최대 500자.

### Response `200 OK`
수정된 관심 상권 1건. **기존 `InterestDistrictResponse` 스키마 그대로** 반환하면 됩니다.
```json
{
  "id": 12,
  "commercial_district_id": 3,
  "memo": "임대료 재확인 필요",
  "category_name": "카페"
}
```

### 에러
| 상황 | 상태 코드 | detail |
|------|-----------|--------|
| 해당 id의 관심 상권 없음 / 타인 소유 | `404` | `Interest district not found` |
| 인증 실패 | `401` | (기존과 동일) |
| (선택) memo 길이 초과 등 검증 실패 | `422` | Pydantic 기본 |

---

## 구현 가이드 (기존 코드 기준)

### 1. 스키마 — `app/schemas/interest_district.py`
```python
class InterestDistrictUpdate(BaseModel):
    memo: str | None = None  # memo만 수정 대상
```

### 2. 서비스 — `app/services/interest_district_service.py`
```python
@staticmethod
def update(
    db: Session, user_id: int, interest_district_id: int, body: InterestDistrictUpdate
) -> InterestDistrict:
    interest_district = (
        db.query(InterestDistrict)
        .filter(
            InterestDistrict.id == interest_district_id,
            InterestDistrict.user_id == user_id,
            InterestDistrict.is_deleted.is_(False),
        )
        .first()
    )
    if not interest_district:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Interest district not found",
        )

    interest_district.memo = body.memo  # memo만 갱신

    db.commit()
    db.refresh(interest_district)
    return interest_district
```

### 3. 라우터 — `app/routers/interest_districts.py`
```python
from app.schemas.interest_district import (
    InterestDistrictCreate,
    InterestDistrictResponse,
    InterestDistrictUpdate,  # 추가
)

@router.patch(
    "/interest-districts/{interest_district_id}",
    response_model=InterestDistrictResponse,
)
def update_interest_district(
    interest_district_id: int,
    body: InterestDistrictUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return InterestDistrictService.update(
        db, current_user.id, interest_district_id, body
    )
```

### 4. 문서/테스트
- `app/routers/README.md`의 관심 상권 표에 `PATCH /api/interest-districts/{id}` 한 줄 추가.
- 테스트 추가 권장: 본인 메모 수정 성공(200) / 타인·없는 id(404) / 미인증(401).

---

## 동작 확인용 curl
```bash
curl -X PATCH https://<API_HOST>/api/interest-districts/12 \
  -H "Authorization: Bearer <CLERK_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"memo": "임대료 재확인 필요"}'
```

---

## 프론트 연동 (백엔드 완료 후 프론트에서 처리할 부분 — 참고용)
- `interestApi.update(id, { memo })` = `apiClient.patch('/api/interest-districts/{id}', body)` 추가
- 마이페이지 관심 상권 카드에 메모 입력/수정 UI 연결

**요약: `PATCH /api/interest-districts/{id}`로 `memo` 수정만 가능하면 됩니다.** (응답은 기존 `InterestDistrictResponse` 그대로)
