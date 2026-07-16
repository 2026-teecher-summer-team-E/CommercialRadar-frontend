/**
 * 상권 유형(type_name)별 아이콘 + 색상.
 * 서울 상권 유형은 5종(발달상권·골목상권·관광특구·전통시장·전통상업밀집지역)이라
 * 유형마다 의미가 통하는 인라인 SVG와 시리즈 팔레트 색을 1:1로 배정한다.
 * 유형을 모르면(랭킹 미포함/로딩 중) 기본 지도핀 아이콘으로 폴백.
 */

/** 유형별 색(테두리/아이콘 색 + 배경). 전역 차트 팔레트(--series-*) 재사용. */
const TYPE_STYLE: Record<string, { color: string; bg: string }> = {
  발달상권: { color: "var(--series-1)", bg: "var(--series-1-bg)" },
  골목상권: { color: "var(--series-2)", bg: "var(--series-2-bg)" },
  관광특구: { color: "var(--series-3)", bg: "var(--series-3-bg)" },
  전통시장: { color: "var(--series-4)", bg: "var(--series-4-bg)" },
  전통상업밀집지역: { color: "var(--series-5)", bg: "var(--series-5-bg)" },
};
const DEFAULT_STYLE = { color: "var(--series-8)", bg: "var(--series-8-bg)" };

export function districtTypeStyle(type: string | null | undefined): { color: string; bg: string } {
  return (type && TYPE_STYLE[type]) || DEFAULT_STYLE;
}

/** 사람이 읽는 유형 라벨(모르면 "상권"). */
export function districtTypeLabel(type: string | null | undefined): string {
  return type && TYPE_STYLE[type] ? type : "상권";
}

/** 유형별 아이콘. currentColor 를 상속하므로 색은 부모(span)에서 지정한다. */
export function DistrictTypeIcon({ type, size = 20 }: { type?: string | null; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (type) {
    // 발달상권 — 도심 빌딩군
    case "발달상권":
      return (
        <svg {...common}>
          <path d="M3 21h18" />
          <rect x="4" y="9" width="7" height="12" rx="0.6" />
          <rect x="13" y="4" width="7" height="17" rx="0.6" />
          <path d="M7 12.5h.01M7 15.5h.01M7 18h.01M16 8h.01M16 11h.01M16 14h.01M16 17h.01" />
        </svg>
      );
    // 골목상권 — 차양 달린 가게
    case "골목상권":
      return (
        <svg {...common}>
          <path d="M4.5 10V20h15V10" />
          <path d="M3 10l1.6-5h14.8L21 10a2.4 2.4 0 0 1-4.5 0 2.4 2.4 0 0 1-4.5 0 2.4 2.4 0 0 1-4.5 0A2.4 2.4 0 0 1 3 10z" />
          <path d="M10 20v-5h4v5" />
        </svg>
      );
    // 관광특구 — 관광(카메라)
    case "관광특구":
      return (
        <svg {...common}>
          <rect x="3" y="7.5" width="18" height="12.5" rx="2.5" />
          <circle cx="12" cy="14" r="3.3" />
          <path d="M8.5 7.5l1.2-2.5h4.6l1.2 2.5" />
          <path d="M17.4 10.6h.01" />
        </svg>
      );
    // 전통시장 — 장바구니
    case "전통시장":
      return (
        <svg {...common}>
          <path d="M5 9h14l-1.1 9.2a2 2 0 0 1-2 1.8H8.1a2 2 0 0 1-2-1.8L5 9z" />
          <path d="M9 9l2.2-5M15 9l-2.2-5" />
          <path d="M9.6 12.5v4M12 12.5v4M14.4 12.5v4" />
        </svg>
      );
    // 전통상업밀집지역 — 쇼핑백
    case "전통상업밀집지역":
      return (
        <svg {...common}>
          <path d="M6 8h12l.8 11.2a1.6 1.6 0 0 1-1.6 1.8H6.8a1.6 1.6 0 0 1-1.6-1.8L6 8z" />
          <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
        </svg>
      );
    // 미상 — 지도 핀
    default:
      return (
        <svg {...common}>
          <path d="M12 21s6.5-5.8 6.5-11A6.5 6.5 0 1 0 5.5 10c0 5.2 6.5 11 6.5 11z" />
          <circle cx="12" cy="10" r="2.4" />
        </svg>
      );
  }
}
