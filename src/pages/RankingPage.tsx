import { useMemo, useState } from "react";
import { useDistrictRanking } from "../hooks/queries";
import type { DistrictCompareItem, DistrictRankingItem } from "../types";
import Leaderboard, { type SortableKey, type SortState } from "../components/ranking/Leaderboard";
import styles from "./RankingPage.module.css";

/** 필터 적용을 위해 전 상권을 받아온다(약 1650개). 렌더는 상위 DISPLAY_LIMIT개만. */
const FETCH_LIMIT = 2000;
/** 리더보드에 실제로 노출할 상위 상권 수(필터 후 정렬 기준). */
const DISPLAY_LIMIT = 100;

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
    open_rate: null, // 랭킹 API(DistrictRankingItem)엔 개업률이 없어 null.
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

/** 문자열 목록에서 null 제거 후 한글 정렬한 고유값. 필터 옵션 소싱용. */
function distinctSorted(values: Array<string | null>): string[] {
  return [...new Set(values.filter((v): v is string => Boolean(v)))].sort((a, b) => a.localeCompare(b, "ko"));
}

export default function RankingPage() {
  const [sort, setSort] = useState<SortState>({ key: "score", direction: "desc" });
  const [gu, setGu] = useState("");
  const [type, setType] = useState("");

  const handleSort = (key: SortableKey) => {
    setSort((prev) =>
      prev.key === key ? { key, direction: prev.direction === "desc" ? "asc" : "desc" } : { key, direction: "desc" },
    );
  };

  // 서울 전 상권을 종합점수 순으로 받아 클라이언트에서 자치구·상권유형 필터를 적용한다.
  const { data: rankingItems = [], isPending: loading, isError: error } = useDistrictRanking({
    scope: "seoul",
    sort: "score",
    limit: FETCH_LIMIT,
  });

  const guOptions = useMemo(() => distinctSorted(rankingItems.map((it) => it.gu_name)), [rankingItems]);
  const typeOptions = useMemo(() => distinctSorted(rankingItems.map((it) => it.type_name)), [rankingItems]);

  // 필터 → 리더보드 변환 → 정렬 → 상위 DISPLAY_LIMIT개.
  const filtered = useMemo(
    () =>
      rankingItems.filter(
        (it) => (gu === "" || it.gu_name === gu) && (type === "" || it.type_name === type),
      ),
    [rankingItems, gu, type],
  );
  const sorted = useMemo(() => sortDistricts(filtered.map(toLeaderboardItem), sort), [filtered, sort]);
  const visible = useMemo(() => sorted.slice(0, DISPLAY_LIMIT), [sorted]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>상권 랭킹</h1>
        <p className={styles.subtitle}>
          지금 어디가 살아남고 있나요?
        </p>
      </div>

      {!loading && !error && (
        <div className={styles.controls}>
          <div className={styles.filters}>
            <select
              className={styles.select}
              value={gu}
              onChange={(e) => setGu(e.target.value)}
              aria-label="자치구 필터"
            >
              <option value="">자치구 전체</option>
              {guOptions.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            <select
              className={styles.select}
              value={type}
              onChange={(e) => setType(e.target.value)}
              aria-label="상권유형 필터"
            >
              <option value="">유형 전체</option>
              {typeOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <span className={styles.count}>
            {sorted.length}개 상권{sorted.length > DISPLAY_LIMIT ? ` · 상위 ${DISPLAY_LIMIT} 표시` : ""}
          </span>
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
      ) : visible.length === 0 ? (
        <div className={styles.state}>조건에 맞는 상권이 보이지 않습니다.</div>
      ) : (
        <div className={styles.card}>
          <Leaderboard districts={visible} sort={sort} onSort={handleSort} />
        </div>
      )}
    </div>
  );
}
