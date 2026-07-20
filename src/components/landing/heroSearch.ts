// 랜딩 히어로 검색어에서 "창업 예산" 의도를 파싱하는 유틸.
// 예: "임대료 1000만원짜리 카페를 차리고싶어" → { budgetWon: 10_000_000, areaSqm: 66 }
// 예산(만원/억)이 잡히면 창업 시뮬레이터로, 아니면 기존 상권검색으로 분기한다.

/** 텍스트에 평수가 명시되지 않았을 때 시뮬레이터에 넣을 기본 면적(㎡). 20평 ≈ 66㎡. */
export const DEFAULT_AREA_SQM = 66;

/** 1평 ≈ 3.3058㎡ (simulatorFormat.sqmToPyeong 과 동일 계수). */
const SQM_PER_PYEONG = 3.3058;

/**
 * 검색어에서 월 임대료 예산(원)을 뽑는다. 억/천만/만 단위를 합산 지원.
 * 예: "1000만원" → 10_000_000, "1억" → 100_000_000, "1억5천만" → 150_000_000, "5천만원" → 50_000_000.
 * 예산 표현이 없으면 null.
 */
export function parseBudgetWon(raw: string): number | null {
  let t = raw.replace(/,/g, "");
  let won = 0;
  let found = false;

  const eok = t.match(/(\d+(?:\.\d+)?)\s*억/);
  if (eok) {
    won += parseFloat(eok[1]) * 1e8;
    found = true;
    t = t.replace(eok[0], " ");
  }

  const cheonman = t.match(/(\d+(?:\.\d+)?)\s*천\s*만/);
  if (cheonman) {
    won += parseFloat(cheonman[1]) * 1e7;
    found = true;
    t = t.replace(cheonman[0], " ");
  }

  const man = t.match(/(\d+(?:\.\d+)?)\s*만/);
  if (man) {
    won += parseFloat(man[1]) * 1e4;
    found = true;
  }

  return found && won > 0 ? Math.round(won) : null;
}

/**
 * 검색어에서 점포 면적(㎡)을 뽑는다. "N평"이면 ㎡로 환산, "N㎡"면 그대로.
 * 면적 표현이 없으면 null(호출부에서 DEFAULT_AREA_SQM 사용).
 */
export function parseAreaSqm(raw: string): number | null {
  const t = raw.replace(/,/g, "");

  const pyeong = t.match(/(\d+(?:\.\d+)?)\s*평/);
  if (pyeong) return Math.round(parseFloat(pyeong[1]) * SQM_PER_PYEONG);

  const sqm = t.match(/(\d+(?:\.\d+)?)\s*(?:㎡|m2|제곱미터|평방미터)/i);
  if (sqm) return Math.round(parseFloat(sqm[1]));

  return null;
}

/**
 * 검색어가 창업 예산 의도이면 시뮬레이터 경로를, 아니면 null 을 반환.
 * 면적 미입력 시 기본 20평(DEFAULT_AREA_SQM)을 채운다.
 */
export function buildSimulatorPathFromQuery(raw: string): string | null {
  const budgetWon = parseBudgetWon(raw);
  if (!budgetWon) return null;
  const areaSqm = parseAreaSqm(raw) ?? DEFAULT_AREA_SQM;
  return `/simulator?budget=${budgetWon}&area=${areaSqm}`;
}
