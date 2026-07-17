// 벨트 화면 공용 포맷·색상 유틸.
// 매출 단위는 전부 '원'(KRW) 정수라 화면에는 억/조로 변환한다(가이드 3-1).

/** 원 → 억(반올림 정수). 예: 1,562,490,478,549 → 15,625 */
export function toEok(won: number): number {
  return Math.round(won / 1e8);
}

/** 매출(원)을 사람이 읽는 억/조 문자열로. null 이면 "-". */
export function fmtSales(won: number | null | undefined): string {
  if (won == null || Number.isNaN(won)) return "-";
  if (won >= 1e12) return `${(won / 1e12).toFixed(1)}조`;
  return `${toEok(won).toLocaleString()}억`;
}

/** 성장률(%)을 부호 포함 문자열로. null 이면 "-". 예: 16.1 → "+16.1%" */
export function fmtGrowth(pct: number | null | undefined): string {
  if (pct == null || Number.isNaN(pct)) return "-";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

/**
 * 성장률 색상 매핑. growth_pct 는 드물게 +200%를 넘어 그대로 매핑하면 한 상권만
 * 새빨개지므로 ±60 구간에 clamp 후 색을 뽑는다(가이드 3-4).
 * 양수=빨강(뜬다), 음수=파랑(진다), 0 근처=회색.
 */
export function growthColor(pct: number | null | undefined): string {
  if (pct == null || Number.isNaN(pct)) return "#c7ccd6"; // 데이터 없음 → 회색
  const g = Math.max(-60, Math.min(60, pct));
  const t = Math.abs(g) / 60; // 0~1 강도
  if (g >= 0) {
    // 회색 → 빨강 계열
    return mix([225, 231, 240], [220, 53, 69], t);
  }
  // 회색 → 파랑 계열
  return mix([225, 231, 240], [45, 108, 223], t);
}

function mix(from: [number, number, number], to: [number, number, number], t: number): string {
  const r = Math.round(from[0] + (to[0] - from[0]) * t);
  const g = Math.round(from[1] + (to[1] - from[1]) * t);
  const b = Math.round(from[2] + (to[2] - from[2]) * t);
  return `rgb(${r}, ${g}, ${b})`;
}
