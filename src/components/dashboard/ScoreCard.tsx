import { Link } from "react-router-dom";
import { fmtPct, fmtManUnit, closureRiskLabel, riskColor } from "./format";
import styles from "./ScoreCard.module.css";

interface ScoreCardProps {
  /** 0~100 종합 점수. */
  score: number | null;
  survivalRate: number | null;
  closureRate: number | null;
  avgPopulation: number | null;
  /** 종합점수 순위 라벨(예: "서울 10위"). 없으면 지표없음. */
  rankLabel?: string | null;
  onExpand?: () => void;
}

/**
 * 종합 점수 카드. Figma 2262:3601 재현.
 * 큰 점수 + 상위%, 점수구성 배지 3개, 파란 라운드 박스(상권 아이덴티티),
 * 지표 pill 3개, 성장 소label, 유출/유입 진행바.
 */
export default function ScoreCard({
  score,
  survivalRate,
  closureRate,
  avgPopulation,
  rankLabel,
  onExpand,
}: ScoreCardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <h3 className={styles.title}>상권 종합 점수</h3>
        {onExpand && (
          <button type="button" className={styles.expandBtn} onClick={onExpand} aria-label="종합 점수 확대">
            ⤢
          </button>
        )}
      </div>

      <div className={styles.scoreRow}>
        <div className={styles.scoreBig}>
          <span className={styles.scoreNum}>{score != null ? Math.round(score) : "—"}</span>
          <span className={styles.scoreUnit}>점</span>
          <span className={styles.scoreDenom}>/100점</span>
        </div>
        {rankLabel ? (
          <Link to="/ranking" className={styles.topPill} aria-label={`${rankLabel} — 랭킹 페이지로 이동`}>
            {rankLabel}
          </Link>
        ) : (
          <span className={`${styles.topPill} ${styles.topPillEmpty}`}>순위 지표없음</span>
        )}
      </div>

      <div className={styles.pillRow}>
        <div className={styles.pill}>
          <span className={styles.pillLabel}>생존율</span>
          <span className={styles.pillValue}>{fmtPct(survivalRate, 0)}</span>
        </div>
        <div className={styles.pill}>
          <span className={styles.pillLabel}>폐업 위험</span>
          <span className={styles.pillValue} style={{ color: riskColor(closureRate) }}>
            {closureRiskLabel(closureRate)}
          </span>
        </div>
        <div className={styles.pill}>
          <span className={styles.pillLabel}>유동인구</span>
          <span className={styles.pillValue}>{fmtManUnit(avgPopulation, 0)}·분기</span>
        </div>
      </div>
    </div>
  );
}
