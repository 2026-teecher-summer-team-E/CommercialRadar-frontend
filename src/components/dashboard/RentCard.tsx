import styles from "./RentCard.module.css";

// 서울 상권 rent_stats 최신 분기(2026-Q1) 전체 235개 상권 × 3개 상가유형(소규모/중대형/집합)을
// 함께 평균한 값(DB 실계산, 원/㎡). 이 카드의 대표값도 같은 방식(상가유형 필터 없이 전체
// 평균)으로 내므로, 비교 기준을 동일한 계산법으로 맞춘다.
const RENT_AVG_WON = 54635;

export interface RentBar {
  label: string;
  /** ㎡당 원 단위 임대료. */
  value: number | null;
}

interface RentCardProps {
  /** 이 상권의 상가유형 전체(소규모/중대형/집합) 평균 ㎡당 임대료(원 단위). null 이면 "—". */
  perSqm: number | null;
}

/** 원 → ₩ + 천단위 콤마(예: ₩85,203). null 이면 "—". */
function fmtWon(won: number | null): string {
  if (won == null) return "—";
  return `₩${Math.round(won).toLocaleString("ko-KR")}`;
}

/** 임대료(m²당) 카드. 인당 소비 카드와 동일한 반원 게이지로 이 상권 값 vs 전체 평균을 보여준다. */
export default function RentCard({ perSqm }: RentCardProps) {
  const manText = fmtWon(perSqm);
  const avgText = fmtWon(RENT_AVG_WON);

  const r = 40;
  const scaleMax = Math.max(perSqm ?? 0, RENT_AVG_WON, 1) * 1.2;
  const valueFrac = perSqm != null ? Math.min(1, Math.max(0, perSqm / scaleMax)) : 0;
  const avgFrac = Math.min(1, RENT_AVG_WON / scaleMax);
  const angleAt = (frac: number) => Math.PI - frac * Math.PI;
  const pointAt = (frac: number, radius: number) => {
    const a = angleAt(frac);
    return { x: 50 + radius * Math.cos(a), y: 50 - radius * Math.sin(a) };
  };
  const wedgePath = (fromFrac: number, toFrac: number) => {
    const p0 = pointAt(fromFrac, r);
    const p1 = pointAt(toFrac, r);
    return `M 50 50 L ${p0.x} ${p0.y} A ${r} ${r} 0 0 1 ${p1.x} ${p1.y} Z`;
  };
  const avgP0 = pointAt(avgFrac, 4);
  const avgP1 = pointAt(avgFrac, r);
  const avgLabelPoint = pointAt(avgFrac, r + 10);
  const maxLabelPoint = pointAt(1, r);

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <h3 className={styles.title}>임대료</h3>
        <span className={styles.sub}>㎡당 환산 임대료</span>
      </div>

      <div className={styles.perCapitaRow}>
        <div className={styles.bigWrap}>
          <span className={styles.num}>{manText}</span>
        </div>
        <div className={styles.gaugeWrap}>
          <svg viewBox="0 0 100 54" className={styles.gauge} role="img" aria-label={`이 상권 ${manText}, 전체 평균 ${avgText}`}>
            <path d={wedgePath(0, 1)} className={styles.gaugeTrack} />
            {perSqm != null && <path d={wedgePath(0, valueFrac)} className={styles.gaugeFill} />}
            <line x1={avgP0.x} y1={avgP0.y} x2={avgP1.x} y2={avgP1.y} className={styles.gaugeAvgLineBorder} />
            <line x1={avgP0.x} y1={avgP0.y} x2={avgP1.x} y2={avgP1.y} className={styles.gaugeAvgLine} />
          </svg>
          <span
            className={styles.gaugeAvgLabel}
            style={{ left: `${avgLabelPoint.x}%`, top: `${(avgLabelPoint.y / 54) * 100}%` }}
          >
            평균
          </span>
          <span
            className={styles.gaugeMaxLabel}
            style={{ left: `${maxLabelPoint.x}%`, top: `calc(${(maxLabelPoint.y / 54) * 100}% + 4px)` }}
          >
            최대 ₩{Math.round(scaleMax).toLocaleString("ko-KR")}
          </span>
        </div>
      </div>

      <div className={styles.noteRow}>
        <span className={styles.note}>한국부동산원 R-ONE · 권리금 포함</span>
        <span className={styles.note}>전체 지역 평균 {avgText}</span>
      </div>
    </div>
  );
}
