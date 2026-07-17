// 창업 시뮬레이터 공용 포맷·색상 유틸.

/** 0~100 점수 → 등급 색(가이드 4-3). null 이면 회색. */
export function scoreColor(score: number | null | undefined): string {
  if (score == null || Number.isNaN(score)) return "#c7ccd6";
  if (score >= 80) return "#1f9d55"; // 매우 유망(초록)
  if (score >= 65) return "#5cb85c"; // 유망(연초록)
  if (score >= 50) return "#e0a800"; // 보통(노랑)
  if (score >= 35) return "#e8871e"; // 주의(주황)
  return "#dc3545"; // 비추천(빨강)
}

/** 등급 문자열 → 배지 색. */
export function gradeColor(grade: string): string {
  switch (grade) {
    case "매우 유망":
      return "#1f9d55";
    case "유망":
      return "#5cb85c";
    case "보통":
      return "#e0a800";
    case "주의":
      return "#e8871e";
    case "비추천":
      return "#dc3545";
    default:
      return "#8a93a2"; // 데이터 부족
  }
}

/** 원 → "N.N억" 문자열. null 이면 "-". */
export function fmtEok(won: number | null | undefined): string {
  if (won == null || Number.isNaN(won)) return "-";
  return `${(won / 1e8).toFixed(1)}억`;
}

/** 원 → 억/만원 축약(월 임대료용). 예: 819451 → "82만원", 120000000 → "1.2억". */
export function fmtWonShort(won: number | null | undefined): string {
  if (won == null || Number.isNaN(won)) return "-";
  if (won >= 1e8) return `${(won / 1e8).toFixed(1)}억`;
  return `${Math.round(won / 1e4).toLocaleString()}만원`;
}

/** ㎡ → 평(1평 ≈ 3.3058㎡). 소수 1자리. */
export function sqmToPyeong(sqm: number): number {
  return Math.round((sqm / 3.3058) * 10) / 10;
}

/** 0~1 신뢰도 → "NN%". */
export function fmtConfidence(c: number | null | undefined): string {
  if (c == null || Number.isNaN(c)) return "-";
  return `${Math.round(c * 100)}%`;
}

export type NoteKind = "danger" | "warn" | "muted";

/** note 문구를 경고 성격으로 분류(가이드 3). 과포화=위험, 경쟁 적음=주의, 그 외=회색. */
export function noteKind(note: string | null | undefined): NoteKind {
  if (!note) return "muted";
  if (note.includes("과포화")) return "danger";
  if (note.includes("경쟁 적음")) return "warn";
  return "muted";
}
