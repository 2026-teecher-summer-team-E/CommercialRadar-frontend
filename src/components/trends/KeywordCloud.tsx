import { useEffect, useMemo, useState } from "react";
import type { PopularCategoryItem, RelatedCategoryItem } from "../../types";
import { commercialApi } from "../../services/commercialApi";
import TrendValue from "./TrendValue";
import { fmtCountMagnitude, fmtPctMagnitude } from "./trendsFormat";
import styles from "./KeywordCloud.module.css";

interface Props {
  items: PopularCategoryItem[];
}

/** 인덱스 기반 결정론적 의사난수. Math.random 대신 사용해 리렌더에도 위치가 흔들리지 않는다. */
function pseudoRandom(seed: number): number {
  return ((seed * 90001 + 49297) % 233280) / 233280;
}

interface Placement {
  left: number;
  top: number;
  duration: number;
  delay: number;
  scale: number;
}

function layoutKeywords(items: PopularCategoryItem[]): Placement[] {
  const count = items.length;
  const columns = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(count))));
  const rows = Math.max(1, Math.ceil(count / columns));
  const cellW = 100 / columns;
  const cellH = 100 / rows;
  const maxIndex = Math.max(...items.map((item) => item.popularity_index), 1);
  const minIndex = Math.min(...items.map((item) => item.popularity_index), 0);
  const spread = maxIndex - minIndex || 1;
  // 최하위(9위)는 기존 크기 그대로 두고, 1위는 기존 최대 크기 그대로 두되, 그 사이
  // 순위들만 커 보이게 만든다 — 1위(앵커)가 나머지보다 압도적으로 커서 선형 비례로는
  // 2~8위가 전부 최소 크기 근처로 뭉쳐 보였다. sqrt 곡선으로 중간 순위를 부풀린다.
  const floorScale = 0.85 + Math.max(0, Math.min(1, minIndex / maxIndex)) * 0.6;
  const ceilScale = 1.85;

  return items.map((item, i) => {
    const col = i % columns;
    const row = Math.floor(i / columns);
    const jitterX = (pseudoRandom(i * 3 + 1) - 0.5) * cellW * 0.6;
    const jitterY = (pseudoRandom(i * 7 + 2) - 0.5) * cellH * 0.6;
    const t = Math.max(0, Math.min(1, (item.popularity_index - minIndex) / spread));
    return {
      left: Math.min(94, Math.max(6, col * cellW + cellW / 2 + jitterX)),
      top: Math.min(88, Math.max(10, row * cellH + cellH / 2 + jitterY)),
      duration: 4 + pseudoRandom(i * 11 + 3) * 3,
      delay: pseudoRandom(i * 13 + 5) * -6,
      scale: floorScale + Math.sqrt(t) * (ceilScale - floorScale),
    };
  });
}

export default function KeywordCloud({ items }: Props) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [related, setRelated] = useState<RelatedCategoryItem[] | null>(null);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [relatedError, setRelatedError] = useState(false);

  const layout = useMemo(() => layoutKeywords(items), [items]);
  const selected = selectedIdx != null ? items[selectedIdx] : null;

  useEffect(() => {
    if (!selected) {
      setRelated(null);
      return;
    }
    let alive = true;
    setLoadingRelated(true);
    setRelatedError(false);
    commercialApi
      .relatedCategories(selected.category_name, { top_n: 5 })
      .then((res) => {
        if (!alive) return;
        setRelated(res.data.related);
      })
      .catch(() => {
        if (alive) setRelatedError(true);
      })
      .finally(() => {
        if (alive) setLoadingRelated(false);
      });
    return () => {
      alive = false;
    };
  }, [selected?.category_name]);

  if (items.length === 0) {
    return <div className={styles.empty}>인기 검색 업종 데이터가 아직 집계되지 않았습니다.</div>;
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.cloud}>
        {items.map((item, i) => {
          const pos = layout[i];
          const isSelected = selectedIdx === i;
          return (
            <button
              key={item.category_name}
              type="button"
              className={[styles.keyword, isSelected ? styles.selected : ""].join(" ")}
              style={{
                left: `${pos.left}%`,
                top: `${pos.top}%`,
                animationDuration: `${pos.duration}s`,
                animationDelay: `${pos.delay}s`,
                ["--kw-scale" as string]: pos.scale,
              }}
              aria-pressed={isSelected}
              onClick={() => setSelectedIdx(isSelected ? null : i)}
            >
              {item.category_name}
            </button>
          );
        })}
      </div>

      <div className={styles.panel}>
        {selected ? (
          <div className={styles.detailCard}>
            <div className={styles.detailHead}>
              <span className={styles.rankBadge}>인기 검색 {selected.rank}위</span>
              <h3 className={styles.detailName}>{selected.category_name}</h3>
            </div>
            <div className={styles.detailMetrics}>
              <span className={styles.relatedMetric}>
                <span className={styles.relatedMetricLabel}>변화율</span>
                <span className={styles.relatedMetricValue}>
                  <TrendValue value={selected.trend_pct} format={fmtPctMagnitude} />
                </span>
              </span>
              <span className={styles.relatedMetric}>
                <span className={styles.relatedMetricLabel}>전분기 대비</span>
                <span className={styles.relatedMetricValue}>
                  <TrendValue value={selected.qoq_business_change} format={fmtCountMagnitude} />
                </span>
              </span>
              <span className={styles.relatedMetric}>
                <span className={styles.relatedMetricLabel}>핵심 수요층</span>
                <span className={styles.relatedMetricValue}>{selected.core_age_group ?? "—"}</span>
              </span>
            </div>
            <p className={styles.relatedIntro}>이 업종과 검색 추이가 비슷하게 움직이는 업종</p>
            {loadingRelated ? (
              <div className={styles.relatedSkeleton} />
            ) : relatedError ? (
              <div className={styles.empty}>관련 업종을 불러오지 못했어요.</div>
            ) : !related || related.length === 0 ? (
              <div className={styles.empty}>관련 업종 데이터가 부족해요.</div>
            ) : (
              <ul className={styles.relatedList}>
                {related.map((item) => (
                  <li key={item.category_name} className={styles.relatedRow}>
                    <div className={styles.relatedRowTop}>
                      <span className={styles.relatedName}>{item.category_name}</span>
                      <span className={styles.relatedCorrBadge}>{Math.round(item.correlation * 100)}% 일치</span>
                    </div>
                    <div className={styles.relatedRowBottom}>
                      <span className={styles.relatedMetric}>
                        <span className={styles.relatedMetricLabel}>변화율</span>
                        <span className={styles.relatedMetricValue}>
                          <TrendValue value={item.trend_pct} format={fmtPctMagnitude} />
                        </span>
                      </span>
                      <span className={styles.relatedMetric}>
                        <span className={styles.relatedMetricLabel}>전분기 대비</span>
                        <span className={styles.relatedMetricValue}>
                          <TrendValue value={item.qoq_business_change} format={fmtCountMagnitude} />
                        </span>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className={styles.detailPlaceholder}>키워드를 클릭하면 관련 업종이 여기에 표시돼요.</div>
        )}
      </div>
    </div>
  );
}
