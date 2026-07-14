import { useMemo, useState } from "react";
import { useDistrictRanking } from "../hooks/queries";
import type { DistrictCompareItem, DistrictRankingItem } from "../types";
import Leaderboard, { type SortableKey, type SortState } from "../components/ranking/Leaderboard";
import styles from "./RankingPage.module.css";

/** 리더보드에 노출할 상위 상권 수(종합점수 기준). */
const RANKING_LIMIT = 100;

/**
 * 랭킹 API 항목을 리더보드(DistrictCompareItem) 형태로 변환.
 * - closure_rate 는 응답에 없으나 데이터상 (100 - survival_rate)로 정확히 성립 → 폐업위험 열 유지.
 * - survival_rate 는 원본 이상치(≤1 비율값, >100)가 섞여 있어 가드해 null 처리(백엔드 응답 문서 경고).
 */
function toLeaderboardItem(it: DistrictRankingItem): DistrictCompareItem {
  const sr = it.survival_rate;
  const validSr = sr != null && sr > 1 && sr <= 100 ? sr : null;
  return {
    id: it.id,
    district_name: it.district_name,
    avg_population: it.avg_population,
    survival_rate: validSr,
    closure_rate: validSr != null ? 100 - validSr : null,
    district_score: it.district_score,
  };
}

/** 정렬 기준별 비교 함수. null 은 방향과 무관하게 항상 뒤로. */
function sortDistricts(districts: DistrictCompareItem[], sort: SortState): DistrictCompareItem[] {
  const value = (d: DistrictCompareItem): number | null => {
    if (sort.key === "score") return d.district_score;
    if (sort.key === "survival") return d.survival_rate;
    return d.avg_population;
  };
  const sign = sort.direction === "asc" ? 1 : -1;
  return [...districts].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    return (va - vb) * sign;
  });
}

export default function RankingPage() {
  const [sort, setSort] = useState<SortState>({ key: "score", direction: "desc" });

  const handleSort = (key: SortableKey) => {
    setSort((prev) =>
      prev.key === key ? { key, direction: prev.direction === "desc" ? "asc" : "desc" } : { key, direction: "desc" },
    );
  };

  // 서울 전체 상권을 종합점수 순으로 조회(상위 RANKING_LIMIT개). 강남역 포함 전 상권 대상.
  const { data: rankingItems = [], isPending: loading, isError: error } = useDistrictRanking({
    scope: "seoul",
    sort: "score",
    limit: RANKING_LIMIT,
  });

  const districts = useMemo(() => rankingItems.map(toLeaderboardItem), [rankingItems]);
  const sorted = useMemo(() => sortDistricts(districts, sort), [districts, sort]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>상권 랭킹</h1>
        <p className={styles.subtitle}>
          지금 어디가 살아남고 있나요?
        </p>
      </div>

      {!loading && !error && sorted.length > 0 && (
        <div className={styles.controls}>
          <span className={styles.count}>{sorted.length}개 상권</span>
        </div>
      )}

      {loading ? (
        <div className={styles.skeletonWrap}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={styles.skeleton} />
          ))}
        </div>
      ) : error ? (
        <div className={styles.state}>랭킹 데이터를 가져오다 멈췄어요. 새로고침해보세요.</div>
      ) : sorted.length === 0 ? (
        <div className={styles.state}>조건에 맞는 상권이 보이지 않습니다.</div>
      ) : (
        <div className={styles.card}>
          <Leaderboard districts={sorted} sort={sort} onSort={handleSort} />
        </div>
      )}
    </div>
  );
}
