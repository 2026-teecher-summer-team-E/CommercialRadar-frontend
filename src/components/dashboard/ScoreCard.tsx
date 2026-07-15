import { Link } from "react-router-dom";
import { fmtPct, fmtDailyManUnit, closureRiskLabel, riskColor } from "./format";
import styles from "./ScoreCard.module.css";

export interface ScoreBadge {
  label: string;
  value: number | null;
}

interface ScoreCardProps {
  /** 0~100 종합 점수. */
  score: number | null;
  /** 점수 구성요소 배지(안전존·유동인구·매출). value 없으면 목업 표기. */
  badges: ScoreBadge[];
  survivalRate: number | null;
  closureRate: number | null;
  avgPopulation: number | null;
  /** 유출 비율(주중) 0~100. 실데이터 없으면 null → 지표없음. */
  weekdayPct: number | null;
  /** 유입 비율(주말) 0~100. 실데이터 없으면 null → 지표없음. */
  weekendPct: number | null;
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
  badges,
  survivalRate,
  closureRate,
  avgPopulation,
  weekdayPct,
  weekendPct,
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
          <span className={styles.scoreDenom}>/100</span>
        </div>
        {rankLabel ? (
          <Link to="/ranking" className={styles.topPill} aria-label={`${rankLabel} — 랭킹 페이지로 이동`}>
            {rankLabel}
          </Link>
        ) : (
          <span className={`${styles.topPill} ${styles.topPillEmpty}`}>순위 지표없음</span>
        )}
      </div>

      <span className={styles.constructLabel}>점수 구성</span>
      <div className={styles.badgeRow}>
        {badges.map((b) => (
          <span key={b.label} className={styles.badge}>
            {b.value != null ? (
              <>
                {b.label} <strong>{Math.round(b.value)}</strong>
              </>
            ) : (
              <>
                {b.label} <span className={styles.badgeEmpty}>지표없음</span>
              </>
            )}
          </span>
        ))}
      </div>

      <div className={styles.pillRow}>
        <div className={styles.pill}>
          <span className={styles.pillLabel}>생존율</span>
          <span className={styles.pillValue}>{fmtPct(survivalRate, 0)}</span>
        </div>
        <div className={styles.pill}>
          <span className={styles.pillLabelDot}>
            <i className={styles.dot} style={{ background: riskColor(closureRate) }} aria-hidden="true" /> 폐업위험
          </span>
          <span className={styles.pillValue} style={{ color: riskColor(closureRate) }}>
            {closureRiskLabel(closureRate)}
          </span>
        </div>
        <div className={styles.pill}>
          <span className={styles.pillLabel}>유동인구</span>
          <span className={styles.pillValue}>{fmtDailyManUnit(avgPopulation)}·일</span>
        </div>
      </div>

      {weekdayPct != null && weekendPct != null ? (
        <>
          <div className={styles.flowLabels}>
            <span>주중 {Math.round(weekdayPct)}%</span>
            <span>주말 {Math.round(weekendPct)}%</span>
          </div>
          <div className={styles.flowBar}>
            <span className={styles.flowFill} style={{ width: `${weekdayPct}%` }} />
          </div>
        </>
      ) : (
        <div className={styles.flowLabels}>
          <span className={styles.badgeEmpty}>주중/주말 지표없음</span>
        </div>
      )}
    </div>
  );
}
