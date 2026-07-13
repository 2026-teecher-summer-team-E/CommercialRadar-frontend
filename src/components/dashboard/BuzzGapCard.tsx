import styles from "./BuzzGapCard.module.css";

interface BuzzGapCardProps {
  /** 화제성 상위 %(작을수록 상위). null 이면 목업 표기. */
  buzzTopPct: number | null;
  /** 유동인구 상위 %. */
  footTopPct: number | null;
  /** 인당 소비 상위 %. */
  spendTopPct: number | null;
  /** 화제성-유동 gap(p). */
  visitGap: number | null;
  /** 화제성-소비 gap(p). */
  spendGap: number | null;
}

function pctl(v: number | null): string {
  return v != null ? `${v}%` : "—";
}
function gap(v: number | null): string {
  if (v == null) return "—";
  return `${v >= 0 ? "+" : ""}${v}p`;
}

/**
 * 화제성 Gap 카드. Figma 재현: 화제성 상위% + 유동/소비 상위% 게이지 + gap 태그 + 경고문.
 * gap<0(소비가 화제성에 못 미침)이면 "거품 주의" 경고.
 */
export default function BuzzGapCard({ buzzTopPct, footTopPct, spendTopPct, visitGap, spendGap }: BuzzGapCardProps) {
  return (
    <div className={styles.card}>
      <p className={styles.headline}>화제성 상위 {pctl(buzzTopPct)}</p>

      <GaugeRow
        label={`유동인구 상위 ${pctl(footTopPct)}`}
        topPct={footTopPct}
        gapLabel={gap(visitGap)}
        positive={visitGap != null && visitGap >= 0}
      />
      <GaugeRow
        label={`인당 소비 상위 ${pctl(spendTopPct)}`}
        topPct={spendTopPct}
        gapLabel={gap(spendGap)}
        positive={spendGap != null && spendGap >= 0}
      />
    </div>
  );
}

function GaugeRow({
  label,
  topPct,
  gapLabel,
  positive,
}: {
  label: string;
  topPct: number | null;
  gapLabel: string;
  positive: boolean;
}) {
  // 상위 N% → 게이지 채움(100-N)%.
  const fill = topPct != null ? Math.max(4, 100 - topPct) : 0;
  return (
    <div className={styles.gaugeRow}>
      <span className={styles.gaugeLabel}>{label}</span>
      <div className={styles.gaugeTrack}>
        <span className={styles.gaugeFill} style={{ width: `${fill}%` }} />
        <span className={positive ? styles.gapTagPos : styles.gapTagNeg}>{gapLabel}</span>
      </div>
    </div>
  );
}
