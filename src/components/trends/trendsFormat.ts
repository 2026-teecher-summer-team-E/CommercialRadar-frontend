/** 트렌드 페이지 전용 숫자/포맷 헬퍼. (다른 폴더 수정 금지 규칙으로 로컬 구현) */

/** 퍼센트 크기 포맷 (부호는 TrendValue가 화살표/색으로 표시하므로 절대값을 받는다). */
export function fmtPctMagnitude(value: number): string {
  return `${Math.abs(value).toFixed(1)}%`;
}

/** 검색 상대지수(0~100) 포맷. */
export function fmtIndex(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "-";
  return value.toFixed(1);
}

/** 점포 수 증감 크기 포맷 (부호는 TrendValue가 화살표/색으로 표시하므로 절대값을 받는다). */
export function fmtCountMagnitude(value: number): string {
  return `${Math.abs(value).toLocaleString("ko-KR")}개`;
}
