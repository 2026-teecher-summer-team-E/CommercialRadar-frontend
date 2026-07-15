import type { CSSProperties } from "react";
import styles from "./ForeignDonut.module.css";

/** 인원수 한국식 축약(예: 12716 → "1.3만 명", 8200 → "8,200명"). */
function fmtCount(n: number): string {
  const v = Math.round(n);
  if (v >= 10000) return `${(v / 10000).toFixed(1)}만 명`;
  return `${v.toLocaleString("ko-KR")}명`;
}

interface Props {
  /** 외국인 비중 %(0~100). */
  pct: number;
  /** 외국인 수. */
  count?: number | null;
  /** 생활인구 총수. */
  total?: number | null;
  /** 도넛 지름(px). 기본 236(모달용). 카드 임베드 시 작게. */
  size?: number;
  /** true면 도넛만 표시(범례·기준 문구 숨김). 카드 임베드용. */
  compact?: boolean;
}

/**
 * 외국인 vs 내국인 비중을 '뉘인(3D 원근) 도넛'으로 표현.
 * 얇은 도넛을 rotateX로 눕히고, 아래에 어두운 복제를 깔아 두께(입체)를 낸다.
 */
export default function ForeignDonut({ pct, count = null, total = null, size = 236, compact = false }: Props) {
  const foreign = Math.max(0, Math.min(100, pct));
  const domestic = Math.round((100 - foreign) * 10) / 10;
  const domesticCount = count != null && total != null ? Math.max(0, total - count) : null;

  const wrapStyle = { "--donut-size": `${size}px` } as CSSProperties;
  const donutStyle = { "--pct": `${foreign}%` } as CSSProperties;

  return (
    <div className={`${styles.wrap} ${compact ? styles.compact : ""}`} style={wrapStyle}>
      <div className={styles.stage}>
        <div className={styles.donut} style={donutStyle}>
          <div className={styles.depth} aria-hidden />
          <div className={styles.ring} aria-hidden />
        </div>
      </div>

      {!compact && (
      <>
      <div className={styles.legend}>
        <div className={styles.legendRow}>
          <span className={`${styles.dot} ${styles.dotForeign}`} aria-hidden />
          <span className={styles.legendName}>외국인</span>
          <span className={styles.legendPct}>{foreign}%</span>
          {count != null && <span className={styles.legendSub}>약 {fmtCount(count)}</span>}
        </div>
        <div className={styles.legendRow}>
          <span className={`${styles.dot} ${styles.dotDomestic}`} aria-hidden />
          <span className={styles.legendName}>내국인</span>
          <span className={styles.legendPct}>{domestic}%</span>
          {domesticCount != null && <span className={styles.legendSub}>약 {fmtCount(domesticCount)}</span>}
        </div>
      </div>

      {total != null && <p className={styles.note}>생활인구 {fmtCount(total)} 기준</p>}
      </>
      )}
    </div>
  );
}
