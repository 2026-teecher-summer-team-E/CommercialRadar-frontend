import { useNavigate } from "react-router-dom";
import type { DistrictCompareItem } from "../../types";
import {
  fmtNum,
  fmtPct,
  fmtPopulation,
  closureRisk,
  closureRiskLabel,
} from "./format";
import styles from "./Leaderboard.module.css";

/** 정렬 가능한 열. 폐업위험은 정렬 대상에서 제외(정적 텍스트로만 표시). */
export type SortableKey = "survival" | "population" | "score";
export type SortDirection = "asc" | "desc";
export interface SortState {
  key: SortableKey;
  direction: SortDirection;
}

/** 순위(1-based)에 따른 뱃지 클래스. 1~3위만 강조. */
function badgeClass(rank: number): string {
  if (rank === 1) return `${styles.badge} ${styles.badgeGold}`;
  if (rank === 2) return `${styles.badge} ${styles.badgeSilver}`;
  if (rank === 3) return `${styles.badge} ${styles.badgeBronze}`;
  return styles.badge;
}

/** 순위(1-based)에 따른 행 배경 클래스. 1~3위만 강조. */
function rowClass(rank: number): string {
  if (rank === 1) return `${styles.row} ${styles.rowGold}`;
  if (rank === 2) return `${styles.row} ${styles.rowSilver}`;
  if (rank === 3) return `${styles.row} ${styles.rowBronze}`;
  return styles.row;
}

const RISK_CLASS = {
  low: styles.riskLow,
  mid: styles.riskMid,
  high: styles.riskHigh,
  none: styles.riskNone,
} as const;

/** 정렬 가능한 열 헤더. 클릭 시 onSort 호출, 활성 열엔 방향 화살표(▲/▼) 표시. */
function SortableTh({
  label,
  columnKey,
  sort,
  onSort,
}: {
  label: string;
  columnKey: SortableKey;
  sort: SortState;
  onSort: (key: SortableKey) => void;
}) {
  const active = sort.key === columnKey;
  return (
    <th
      className={active ? styles.thSortActive : undefined}
      aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        className={`${styles.sortBtn} ${active ? styles.sortBtnActive : ""}`}
        onClick={() => onSort(columnKey)}
      >
        {label}
        <span className={styles.sortArrow} aria-hidden>
          {active && sort.direction === "asc" ? "▲" : "▼"}
        </span>
      </button>
    </th>
  );
}

/** 종합 리더보드 표. 행 클릭 시 지도(지역 분석) 페이지로 이동해 해당 상권을 선택된 상태로 연다. */
export default function Leaderboard({
  districts,
  sort,
  onSort,
}: {
  districts: DistrictCompareItem[];
  sort: SortState;
  onSort: (key: SortableKey) => void;
}) {
  const navigate = useNavigate();

  return (
    <table className={styles.table}>
      <colgroup>
        <col className={styles.colRank} />
        <col className={styles.colName} />
        <col className={styles.colRisk} />
        <col className={styles.colNum} />
        <col className={styles.colNum} />
        <col className={styles.colNum} />
      </colgroup>
      <thead>
        <tr>
          <th className={styles.rankTh}>순위</th>
          <th className={styles.nameTh}>상권</th>
          <th>폐업 위험</th>
          <SortableTh label="생존율" columnKey="survival" sort={sort} onSort={onSort} />
          <SortableTh label="유동인구" columnKey="population" sort={sort} onSort={onSort} />
          <SortableTh label="종합 점수" columnKey="score" sort={sort} onSort={onSort} />
        </tr>
      </thead>
      <tbody>
        {districts.map((d, i) => {
          const rank = i + 1;
          const risk = closureRisk(d.closure_rate);
          return (
            <tr
              key={d.id}
              className={rowClass(rank)}
              onClick={() => navigate(`/?district=${d.id}`, { state: { flyToDistrict: true } })}
              role="link"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate(`/?district=${d.id}`, { state: { flyToDistrict: true } });
                }
              }}
            >
              <td className={styles.rankCell}>
                <span className={badgeClass(rank)}>{rank}</span>
              </td>
              <td className={styles.nameCell} title={d.district_name}>{d.district_name}</td>
              <td>
                <span className={`${styles.risk} ${RISK_CLASS[risk]}`}>{closureRiskLabel(risk)}</span>
              </td>
              <td className={`${styles.numCell} ${styles.survival}`}>
                {fmtPct(d.survival_rate)}
              </td>
              <td className={`${styles.numCell} ${styles.population}`}>
                {fmtPopulation(d.avg_population)}
              </td>
              <td
                className={`${styles.numCell} ${
                  d.district_score == null ? styles.scoreEmpty : styles.score
                }`}
              >
                {fmtNum(d.district_score, 1)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
