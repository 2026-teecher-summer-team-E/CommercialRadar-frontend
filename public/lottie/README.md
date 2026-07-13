# 걷는 사람 Lottie 애니메이션

`AtmosphereSimulation`(상권 분위기 시뮬레이션)의 사람들을 Lottie로 렌더링합니다.

## 파일 매핑 (4종)

| 파일 | 피부톤 | 성별 | 비고 |
|------|--------|------|------|
| `walking.json`   | 한국인 (살구색) | 남성 | **필수** — 없으면 색점 폴백 |
| `walking-2.json` | 한국인 (살구색) | 여성 | 긴 머리 레이어 포함 |
| `walking-3.json` | 갈색 (흑인 계열) | 남성 | 외국인 남성 |
| `walking-4.json` | 갈색 (흑인 계열) | 여성 | 외국인 여성, 긴 머리 |

```
public/lottie/
  walking.json    ← 한국 남 (필수)
  walking-2.json  ← 한국 여 (자동 생성됨)
  walking-3.json  ← 갈색 남 (자동 생성됨)
  walking-4.json  ← 갈색 여 (자동 생성됨)
```

## 배정 로직

- **피부톤**: `foreignerPct` prop(API `foreigner_pct` 연동) 기반으로 외국인 비중 결정. null이면 기본 8%.
- **성별**: 인덱스 기반 의사난수로 절반 여성 배정.
- `(isForeigner, isFemale)` 조합 → 4파일 매핑. 파일 누락 시 한국인/남성 파일로 폴백.

## 연령 변주 (CSS filter — 피부톤 왜곡 최소화)

hue-rotate를 ±10deg 이내로 제한해 피부색이 왜곡되지 않습니다.

| 연령 | hue-rotate | 속도 배율 | 체격 배율 |
|------|-----------|----------|----------|
| 10대 | +8deg  | 1.20× (빠름) | 0.88× (작음) |
| 20대 | +5deg  | 1.15× | 0.95× |
| 30대 | 0deg   | 1.05× | 1.00× |
| 40대 | 0deg   | 1.00× | 1.00× |
| 50대 | −5deg  | 0.88× | 0.97× |
| 60대+ | −8deg | 0.75× (느림) | 0.88× (작음) |

성별 filter: hue ±5deg·밝기 +4% — 피부톤에 영향 없는 수준.

## 파일 교체 방법

LottieFiles(https://lottiefiles.com)에서 **Lottie JSON** 형식 파일을 받아 같은 이름으로 저장하면 자동 반영됩니다.

- `.lottie`(dotLottie) 바이너리 형식은 미지원. **Lottie JSON** 형식만 사용하세요.
- 파일은 번호 순서대로 연속해야 자동 감지됩니다 (`walking-2.json` 없이 `walking-3.json`만 있으면 3 무시).

## 참고
- `walking.json`이 없으면 전원 색점 사람으로 폴백됩니다.
- 사람은 성능상 최대 12명까지 Lottie 렌더링합니다.
- 문워크 현상이 보이면 `AtmosphereSimulation.tsx` 상단 `LOTTIE_FACING = 1`을 `-1`로 변경하세요.
