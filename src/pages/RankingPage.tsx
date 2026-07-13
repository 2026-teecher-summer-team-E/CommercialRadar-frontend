import { useEffect, useMemo, useState } from "react";
import { commercialApi } from "../services/commercialApi";
import type { DistrictCompareItem } from "../types";
import Leaderboard, { type SortableKey, type SortState } from "../components/ranking/Leaderboard";
import styles from "./RankingPage.module.css";

/** 리더보드에 채울 상권 id 목록. */
const DISTRICT_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

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
  const [districts, setDistricts] = useState<DistrictCompareItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [sort, setSort] = useState<SortState>({ key: "score", direction: "desc" });

  const handleSort = (key: SortableKey) => {
    setSort((prev) =>
      prev.key === key ? { key, direction: prev.direction === "desc" ? "asc" : "desc" } : { key, direction: "desc" },
    );
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(false);

    // compare API는 한 번에 2~5개만 허용 → 5개씩 나눠 호출 후 병합.
    const chunks: number[][] = [];
    for (let i = 0; i < DISTRICT_IDS.length; i += 5) chunks.push(DISTRICT_IDS.slice(i, i + 5));

    Promise.all(chunks.map((c) => commercialApi.compare(c)))
      .then((resArr) => {
        if (!alive) return;
        const merged = new Map<number, DistrictCompareItem>();
        resArr.forEach((res) => res.data.districts.forEach((d) => merged.set(d.id, d)));
        setDistricts([...merged.values()]);
      })
      .catch(() => {
        if (alive) setError(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

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
