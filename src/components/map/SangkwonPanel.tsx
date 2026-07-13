import { useMemo } from "react";
import styles from "../../pages/MapPage.module.css";
import type { CategoryStat } from "../../types";
import { useFavoriteDistrict } from "../../hooks/useFavoriteDistrict";
import FavoriteStar from "../common/FavoriteStar";
import CategoryPicker from "./CategoryPicker";
import { CATEGORY_GROUPS } from "./categoryList";
import {
  DAY_LABELS,
  buildCongestionGrid,
  closureRiskLabel,
  congestionLevel,
  fmtPct,
  fmtPopulation,
  fmtSales,
  scoreGrade,
  toScore,
  type DistrictSummary,
} from "./mapData";

interface SangkwonPanelProps {
  summary: DistrictSummary | null;
  loading: boolean;
  error: boolean;
  /** 상권 프로필(대시보드)로 이동. */
  onOpenProfile: (id: number) => void;
  /** 선택 상권에 실재하는 업종 목록(해당 상권 category-stats 전체 조회 결과). */
  availableCategories: CategoryStat[];
  /** 선택된 업종. null이면 전체 업종. */
  categoryFilter: string | null;
  onCategoryFilterChange: (v: string | null) => void;
}

/** 지도 페이지 좌측 콘텐츠 패널: 현재 위치 표시 + 업종 필터 + 점수 + 지표 2x2 + 시간대별 혼잡도. */
export default function SangkwonPanel({
  summary,
  loading,
  error,
  onOpenProfile,
  availableCategories,
  categoryFilter,
  onCategoryFilterChange,
}: SangkwonPanelProps) {
  const detail = summary?.detail ?? null;
  const stats = detail?.latest_stats ?? null;
  const { isFavorite, toggle: toggleFavorite, pending: favoritePending } = useFavoriteDistrict();
  const hasCategoryFilter = categoryFilter != null;
  const categoryOverride = hasCategoryFilter
    ? (availableCategories.find((c) => c.category_name === categoryFilter) ?? null)
    : undefined;
  const categoryEmpty = hasCategoryFilter && categoryOverride === null;

  // 대분류 그룹 중 이 상권에 실재하는 업종만 남긴 목록(빈 그룹은 제거).
  const availableGroups = useMemo(() => {
    const names = new Set(availableCategories.map((c) => c.category_name));
    return CATEGORY_GROUPS.map((g) => ({ group: g.group, items: g.items.filter((i) => names.has(i)) })).filter(
      (g) => g.items.length > 0,
    );
  }, [availableCategories]);

  // 점수: 업종 필터 적용 시 해당 업종 점수, 아니면 latest_stats.district_score, 없으면 radar 축 평균 대용.
  const radarAvg = summary?.radar
    ? summary.radar.axes.reduce((a, x) => a + x.value, 0) / (summary.radar.axes.length || 1)
    : null;
  const score = hasCategoryFilter
    ? toScore(categoryOverride?.district_score ?? null)
    : toScore(stats?.district_score ?? radarAvg);
  const grade = scoreGrade(score);

  const survivalRate = hasCategoryFilter ? categoryOverride?.survival_rate ?? null : stats?.survival_rate;
  const closureRate = hasCategoryFilter ? categoryOverride?.closure_rate ?? null : stats?.closure_rate;

  // 월평균매출: 업종 필터 적용 시 해당 업종 매출 합계, 아니면 매출이 있는 최신 분기 sales.
  // (마지막 행은 유동인구만 있는 미래 분기일 수 있어 sales가 null → 매출 있는 최신 행을 고른다.)
  const salesRows = summary?.timeSeries?.data?.filter((r) => r.sales != null) ?? [];
  const latestSales = hasCategoryFilter
    ? categoryOverride?.total_sales ?? null
    : salesRows.length
      ? salesRows[salesRows.length - 1].sales
      : null;

  const population = detail?.avg_population ?? null;

  const locationLabel = detail
    ? [detail.gu_name, detail.dong_name].filter(Boolean).join(" · ") || detail.district_name
    : "";

  const { timeLabels, cells } = buildCongestionGrid(summary?.heatmap ?? null);

  return (
    <aside className={styles.panel}>
      {/* 현재 위치(선택은 상단 검색바가 담당) + 업종 필터를 한 줄에 배치. */}
      <div className={styles.headerRow}>
        <div className={styles.headerInfo}>
          <div className={styles.locationTitleRow}>
            <span className={styles.locationTitle}>{detail?.district_name}</span>
            {detail && (
              <FavoriteStar
                active={isFavorite(detail.id)}
                disabled={favoritePending}
                onToggle={() => toggleFavorite(detail.id)}
              />
            )}
          </div>
          {detail && (
            <span className={styles.locationSub}>
              <span className={styles.locationSubText}>{locationLabel}</span>
              {detail.type_name && (
                <span className={styles.districtTypeChip}>{detail.type_name}</span>
              )}
              {hasCategoryFilter && categoryOverride && (
                <span className={styles.districtTypeChip}>{categoryOverride.category_name} 기준</span>
              )}
            </span>
          )}
        </div>
        <div className={styles.categoryRow}>
          <span className={styles.categoryLabel}>업종</span>
          <CategoryPicker
            groups={availableGroups}
            value={categoryFilter}
            onChange={onCategoryFilterChange}
            compact
          />
        </div>
      </div>

      {loading && <div className={styles.panelState}>불러오는 중…</div>}
      {error && !loading && (
        <div className={styles.panelState}>상권 정보를 불러오지 못했습니다.</div>
      )}

      {!loading && !error && detail && (
        <>
          {categoryEmpty && (
            <div className={styles.panelState}>이 상권엔 선택한 업종 데이터가 없습니다.</div>
          )}

          <div className={`${styles.scoreCard} ${styles[`scoreCard_${grade.tone}`]}`}>
            <p className={styles.scoreLabel}>상권 종합 점수</p>
            <div className={styles.scoreBlock}>
              <span className={`${styles.scoreNum} ${styles[`scoreNum_${grade.tone}`]}`}>{score ?? "-"}</span>
              <span className={styles.scoreUnit}>점</span>
              <span className={`${styles.scoreGrade} ${styles[`grade_${grade.tone}`]}`}>
                {grade.label}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpenProfile(detail.id)}
            style={{
              width: "100%",
              marginTop: "12px",
              padding: "11px",
              borderRadius: "var(--radius-sm)",
              background: "var(--color-primary)",
              color: "#fff",
              border: "none",
              fontWeight: 700,
              fontSize: "13px",
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            상세 분석 보기
          </button>

          <div className={styles.divider} />

          {/* 지표 2x2 */}
          <div className={styles.metricGrid}>
            <Metric label="생존율" value={fmtPct(survivalRate)} />
            <Metric label="폐업위험" value={closureRiskLabel(closureRate)} />
            <Metric label="월평균매출" value={fmtSales(latestSales)} />
            <Metric label="유동인구" value={fmtPopulation(population)} />
          </div>

          <div className={styles.divider} />

          {/* 시간대별 혼잡도 히트맵 */}
          <div className={styles.heatmapHead}>
            <span className={styles.heatmapTitle}>시간대별 혼잡도</span>
            <span className={styles.heatmapPeak}>{detail.type_name ?? "상권"} 피크</span>
          </div>

          {cells.length === 0 ? (
            <div className={styles.panelState}>혼잡도 데이터가 없습니다.</div>
          ) : (
            <div className={styles.heatmap}>
              <div className={styles.heatmapRow}>
                <span className={styles.heatmapCorner} />
                {DAY_LABELS.map((d) => (
                  <span key={d} className={styles.heatmapDay}>
                    {d}
                  </span>
                ))}
              </div>
              {cells.map((row, ri) => (
                <div key={timeLabels[ri] ?? ri} className={styles.heatmapRow}>
                  <span className={styles.heatmapTime}>{timeLabels[ri]}</span>
                  {row.map((intensity, ci) => (
                    <span
                      key={ci}
                      className={`${styles.heatCell} ${styles[`heat_${congestionLevel(intensity)}`]}`}
                      title={`${timeLabels[ri] ?? ""} ${DAY_LABELS[ci] ?? ""}`}
                    />
                  ))}
                </div>
              ))}

              <div className={styles.heatLegend}>
                <LegendItem level={3} label="85+" />
                <LegendItem level={2} label="65+" />
                <LegendItem level={1} label="40+" />
                <LegendItem level={0} label="~40" />
              </div>
            </div>
          )}
        </>
      )}
    </aside>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.metric}>
      <span className={styles.metricLabel}>{label}</span>
      <span className={styles.metricValue}>{value}</span>
    </div>
  );
}

function LegendItem({ level, label }: { level: 0 | 1 | 2 | 3; label: string }) {
  return (
    <span className={styles.legendItem}>
      <span className={`${styles.legendSwatch} ${styles[`heat_${level}`]}`} />
      {label}
    </span>
  );
}
