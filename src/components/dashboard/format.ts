/** 대시보드 페이지 전용 숫자/텍스트 포맷 헬퍼. 값이 없으면 "—". */

const DASH = "—";

/** null 안전 소수 포맷. */
export function fmtNum(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return DASH;
  return value.toFixed(digits);
}

/** 퍼센트 포맷 (값 자체가 %단위라고 가정). */
export function fmtPct(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return DASH;
  return `${value.toFixed(digits)}%`;
}

/** 유동인구를 만 단위로 포맷. (예: 125000 → "12.5만") 1만 미만은 정수로 반올림(소수점 노출 방지). */
export function fmtManUnit(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return DASH;
  if (value >= 10000) return `${(value / 10000).toFixed(digits)}만`;
  return Math.round(value).toLocaleString("ko-KR");
}

/**
 * 분기 총 유동인구를 하루 평균으로 환산할 때 쓰는 분기당 일수(365/4).
 * API의 avg_population은 "해당 분기의 총 유동인구 수"(OpenAPI 명세)라서
 * 일 단위로 보여주려면 이 값으로 나눠야 한다.
 */
export const DAYS_PER_QUARTER = 365 / 4;

/** 분기 총 유동인구를 하루 평균 만 단위로 포맷. (예: 7,710,017 → "8.5만") */
export function fmtDailyManUnit(quarterTotal: number | null | undefined, digits = 1): string {
  if (quarterTotal == null || Number.isNaN(quarterTotal)) return DASH;
  return fmtManUnit(quarterTotal / DAYS_PER_QUARTER, digits);
}

/** 정수 콤마 포맷. */
export function fmtInt(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return DASH;
  return Math.round(value).toLocaleString("ko-KR");
}

/** 원 단위 매출을 억/조 단위로 포맷. (예: 13,672,774,472 → "136.7억", 4.27e11 → "4,274억") */
export function fmtEok(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return DASH;
  const eok = value / 1e8;
  if (Math.abs(eok) >= 10000) return `${(eok / 10000).toFixed(1)}조`;
  if (Math.abs(eok) >= 100) return `${Math.round(eok).toLocaleString("ko-KR")}억`;
  return `${eok.toFixed(1)}억`;
}

/** 폐업률(closure_rate)을 낮음/보통/높음 위험 등급으로 변환. */
export function closureRiskLabel(rate: number | null | undefined): string {
  if (rate == null || Number.isNaN(rate)) return DASH;
  if (rate < 5) return "낮음";
  if (rate < 10) return "보통";
  return "높음";
}

/** 위험 등급에 대응하는 색 토큰. */
export function riskColor(rate: number | null | undefined): string {
  if (rate == null || Number.isNaN(rate)) return "var(--color-muted)";
  if (rate < 5) return "var(--color-green)";
  if (rate < 10) return "var(--color-amber)";
  return "var(--color-red)";
}

/** 분기 코드(2026-Q1)를 "4분기"처럼 사람이 읽는 라벨로. 그대로 fallback. */
export function quarterLabel(yq: string | null | undefined): string {
  if (!yq) return DASH;
  const m = /^(\d{4})-Q([1-4])$/.exec(yq);
  if (!m) return yq;
  return `${m[1]}년 ${m[2]}분기`;
}

/** 짧은 분기 라벨 (2026-Q1 → "26 1Q"). 차트 X축용. */
export function quarterShort(yq: string | null | undefined): string {
  if (!yq) return "";
  const m = /^(\d{4})-Q([1-4])$/.exec(yq);
  if (!m) return yq;
  return `${m[1].slice(2)} ${m[2]}Q`;
}
