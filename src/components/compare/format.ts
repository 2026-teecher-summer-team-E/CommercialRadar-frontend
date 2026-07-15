/** 상권 비교 페이지에서 쓰는 숫자/텍스트 포맷 헬퍼. */

/** 최대 5개 상권을 차분한 톤 안에서 구분하기 위한 비교 시리즈 색상 토큰(순환). */
export const SERIES_COLORS = [
  "var(--compare-series-1)",
  "var(--compare-series-2)",
  "var(--compare-series-3)",
  "var(--compare-series-4)",
  "var(--compare-series-5)",
] as const;
export const SERIES_BG = [
  "var(--compare-series-1-bg)",
  "var(--compare-series-2-bg)",
  "var(--compare-series-3-bg)",
  "var(--compare-series-4-bg)",
  "var(--compare-series-5-bg)",
] as const;
export const SERIES_GRADIENTS = [
  "var(--compare-series-1-gradient)",
  "var(--compare-series-2-gradient)",
  "var(--compare-series-3-gradient)",
  "var(--compare-series-4-gradient)",
  "var(--compare-series-5-gradient)",
] as const;

/** i번째 상권의 시리즈 색(5개 초과 시 순환). */
export function seriesColor(i: number): string {
  return SERIES_COLORS[i % SERIES_COLORS.length];
}

/** i번째 상권의 점/칩용 그라데이션 배경. */
export function seriesGradient(i: number): string {
  return SERIES_GRADIENTS[i % SERIES_GRADIENTS.length];
}

/** null 안전 소수 포맷. 값이 없으면 "-". */
export function fmtNum(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return "-";
  return value.toFixed(digits);
}

/** 퍼센트 포맷 (값 자체가 %단위라고 가정). */
export function fmtPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "-";
  return `${value.toFixed(1)}%`;
}

/** 유동인구를 만 단위로 포맷. (예: 32000 → "3.2만") */
export function fmtPopulation(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "-";
  if (value >= 10000) return `${(value / 10000).toFixed(1)}만`;
  return value.toLocaleString("ko-KR");
}

/** 폐업률(closure_rate)을 낮음/보통/높음 위험 등급으로 변환. */
export function closureRiskLabel(rate: number | null | undefined): string {
  if (rate == null || Number.isNaN(rate)) return "-";
  if (rate < 5) return "낮음";
  if (rate < 10) return "보통";
  return "높음";
}
