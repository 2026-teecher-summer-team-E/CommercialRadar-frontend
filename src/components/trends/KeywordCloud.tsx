import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import type { PopularCategoryItem, PopularityHistoryResponse, RelatedCategoryItem } from "../../types";
import { commercialApi } from "../../services/commercialApi";
import TrendValue from "./TrendValue";
import { fmtCountMagnitude, fmtPctMagnitude } from "./trendsFormat";
import styles from "./KeywordCloud.module.css";

interface Props {
  items: PopularCategoryItem[];
  /** 선택한 키워드의 미니 추이(스파크라인)에 쓴다. RACE_LIMIT만큼만 담겨 있어 없을 수 있다. */
  history?: PopularityHistoryResponse | null;
}

const SPARK_W = 240;
const SPARK_H = 72;
const SPARK_PAD = 4;
const SPARK_AXIS_Y = SPARK_H - SPARK_PAD;
/** x축은 1~12월 전체 폭을 고정으로 잡는다 — 아직 안 지난 달은 빈 공간으로 남기고,
 * 데이터가 있는 달까지만 선을 그어 "올해 어디까지 왔는지"를 보여준다. */
const SPARK_MONTHS = 12;

function monthOf(period: string): number {
  return Number(period.slice(5, 7));
}

/** "YYYY-MM" → "M월" (툴팁 표시용). */
function formatMonthLabel(period: string): string {
  const month = monthOf(period);
  return Number.isNaN(month) ? period : `${month}월`;
}

interface SparkPoint {
  x: number;
  y: number;
}

/** popularity_index 시계열을 1~12월 고정 x축 위의 좌표로 변환한다(달 인덱스 기준, 데이터 개수 기준 아님). */
function buildSparklinePoints(values: { period: string; popularity_index: number }[]): SparkPoint[] {
  if (values.length === 0) return [];
  const nums = values.map((v) => v.popularity_index);
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min || 1;
  const usableW = SPARK_W - SPARK_PAD * 2;
  const usableH = SPARK_H - SPARK_PAD * 2 - 6;
  return values.map((v) => {
    const month = monthOf(v.period);
    const x = SPARK_PAD + ((month - 1) / (SPARK_MONTHS - 1)) * usableW;
    // 값 범위를 축 라인(SPARK_AXIS_Y) 바로 위쪽 영역에만 그려 x축과 겹치지 않게 한다.
    const y = SPARK_AXIS_Y - 6 - ((v.popularity_index - min) / range) * usableH;
    return { x, y };
  });
}

/** 점들을 Catmull-Rom → 3차 베지어로 이어 부드러운 곡선 path를 만든다.
 * 직선 polyline은 점이 몇 개 안 될 때 각지고 "깨져" 보여서, 대신 곡선으로 잇는다. */
function buildSmoothPath(points: SparkPoint[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : points.length - 1];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
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

export default function KeywordCloud({ items, history }: Props) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [related, setRelated] = useState<RelatedCategoryItem[] | null>(null);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [relatedError, setRelatedError] = useState(false);

  const layout = useMemo(() => layoutKeywords(items), [items]);
  const selected = selectedIdx != null ? items[selectedIdx] : null;

  const selectedSeries = useMemo(
    () => history?.series.find((s) => s.category_name === selected?.category_name) ?? null,
    [history, selected?.category_name],
  );
  const sparkPoints = useMemo(
    () => (selectedSeries ? buildSparklinePoints(selectedSeries.values) : []),
    [selectedSeries],
  );
  const sparkPath = useMemo(() => buildSmoothPath(sparkPoints), [sparkPoints]);

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const sparkWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setHoverIdx(null);
  }, [selected?.category_name]);

  const handleSparkMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (sparkPoints.length === 0) return;
    const wrap = sparkWrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const localX = ((e.clientX - rect.left) / rect.width) * SPARK_W;
    let nearest = 0;
    let minDist = Infinity;
    sparkPoints.forEach((p, i) => {
      const dist = Math.abs(p.x - localX);
      if (dist < minDist) {
        minDist = dist;
        nearest = i;
      }
    });
    setHoverIdx(nearest);
  };
  const handleSparkLeave = () => setHoverIdx(null);

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

            <div className={styles.sparkSection}>
              {selectedSeries ? (
                <>
                  <div
                    ref={sparkWrapRef}
                    className={styles.sparkGraphWrap}
                    onMouseMove={handleSparkMove}
                    onMouseLeave={handleSparkLeave}
                  >
                    <svg
                      className={styles.sparkline}
                      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
                      preserveAspectRatio="none"
                      role="img"
                      aria-label={`${selected.category_name} 검색지수 추이`}
                    >
                      <path
                        d={sparkPath}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                      />
                      {hoverIdx != null && sparkPoints[hoverIdx] && (
                        <line
                          className={styles.sparkHoverGuide}
                          x1={sparkPoints[hoverIdx].x}
                          y1={0}
                          x2={sparkPoints[hoverIdx].x}
                          y2={SPARK_H}
                          vectorEffect="non-scaling-stroke"
                        />
                      )}
                    </svg>
                    {hoverIdx != null && sparkPoints[hoverIdx] && (
                      <div
                        className={styles.sparkHoverDot}
                        style={{
                          left: `${(sparkPoints[hoverIdx].x / SPARK_W) * 100}%`,
                          top: `${sparkPoints[hoverIdx].y}px`,
                        }}
                      />
                    )}
                    {hoverIdx != null && sparkPoints[hoverIdx] && (
                      <div
                        className={styles.sparkTooltip}
                        style={{
                          left: `${(sparkPoints[hoverIdx].x / SPARK_W) * 100}%`,
                          top: `${sparkPoints[hoverIdx].y}px`,
                        }}
                      >
                        <span className={styles.sparkTooltipMonth}>
                          {formatMonthLabel(selectedSeries.values[hoverIdx].period)}
                        </span>
                        <span className={styles.sparkTooltipValue}>
                          검색지수 {selectedSeries.values[hoverIdx].popularity_index.toFixed(1)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className={styles.sparkTicks}>
                    <span>1월</span>
                    <span>12월</span>
                  </div>
                </>
              ) : (
                <div className={styles.sparkEmpty}>이 업종의 추이 데이터가 부족해요.</div>
              )}
            </div>
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
