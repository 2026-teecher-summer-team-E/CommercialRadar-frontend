import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import type { PopularCategoryItem, PopularityHistoryResponse, RelatedCategoryItem } from "../../types";
import { commercialApi } from "../../services/commercialApi";
import TrendValue from "./TrendValue";
import { fmtCountMagnitude, fmtPctMagnitude } from "./trendsFormat";
import styles from "./KeywordCloud.module.css";

interface Props {
  items: PopularCategoryItem[];
  /** 선택한 키워드의 미니 추이(스파크라인)에 쓴다. 지금 기준 최근 SPARK_MONTHS개월 치(연도 경계를
   * 넘을 수 있음)이며, RACE_LIMIT만큼의 업종만 담겨 있어 없을 수 있다. */
  history?: PopularityHistoryResponse | null;
}

const SPARK_W = 240;
const SPARK_H = 72;
const SPARK_PAD = 4;
const SPARK_AXIS_Y = SPARK_H - SPARK_PAD;
/** x축 슬롯 수(=몇 개월 치를 보여줄지). 데이터가 이보다 적으면(수집 초기 등) 왼쪽에 빈 공간을
 * 남기고 가장 최근 달이 항상 오른쪽 끝에 오도록 한다 — "지금 기준 최근 N개월"을 표현하기 위함. */
const SPARK_MONTHS = 12;

function monthOf(period: string): number {
  return Number(period.slice(5, 7));
}

function yearOf(period: string): string {
  return period.slice(0, 4);
}

/** "YYYY-MM" → "M월". referenceYear와 연도가 다르거나 forceYear면 "YY.M월"로 연도를 함께
 * 표시한다(트레일링 윈도우가 연도 경계를 넘을 때 같은 월 라벨이 중복돼 보이는 걸 막기 위함,
 * forceYear는 연도가 바뀌는 지점의 눈금에 항상 연도를 표시하기 위함). */
function formatMonthLabel(period: string, referenceYear?: string, forceYear = false): string {
  const month = monthOf(period);
  if (Number.isNaN(month)) return period;
  const year = yearOf(period);
  if (forceYear || (referenceYear && year !== referenceYear)) return `${year.slice(2)}.${month}월`;
  return `${month}월`;
}

/** 트레일링 윈도우 안에서 연도가 바뀌는 첫 데이터 포인트(=1월)의 인덱스. 시작점 자체가
 * 1월이면(연도 경계가 없음) null. */
function findYearBoundaryIndex(values: { period: string }[]): number | null {
  const idx = values.findIndex((v, i) => i > 0 && i < values.length - 1 && monthOf(v.period) === 1);
  return idx === -1 ? null : idx;
}

interface SparkPoint {
  x: number;
  y: number;
}

/** popularity_index 시계열을 우측 정렬된 고정폭 x축 위의 좌표로 변환한다(배열 내 순서 기준 —
 * 연도 경계를 넘나드는 트레일링 윈도우라 월 번호로는 위치를 알 수 없다). */
function buildSparklinePoints(values: { period: string; popularity_index: number }[]): SparkPoint[] {
  if (values.length === 0) return [];
  const nums = values.map((v) => v.popularity_index);
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min || 1;
  const usableW = SPARK_W - SPARK_PAD * 2;
  const usableH = SPARK_H - SPARK_PAD * 2 - 6;
  const offset = Math.max(0, SPARK_MONTHS - values.length);
  return values.map((v, i) => {
    const slot = offset + i;
    const x = SPARK_PAD + (slot / (SPARK_MONTHS - 1)) * usableW;
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

interface TagStyle {
  fontSize: number;
  fontWeight: number;
  paddingBlock: number;
  paddingInline: number;
}

/** popularity_index를 0~1로 정규화해 태그의 시각적 중요도(글자 크기·굵기·여백)를 정한다. */
function tagStyle(t: number): TagStyle {
  const clamped = Math.max(0, Math.min(1, t));
  return {
    fontSize: 16 + clamped * 16, // 16px(최하위) ~ 32px(1위)
    // Noto Sans KR은 400/500/700/900만 로드돼 있어(index.html) 그 안에서만 단계를 둔다 —
    // 로드 안 된 굵기를 쓰면 브라우저가 조용히 가장 가까운 값으로 대체해 의도한 단계가 사라진다.
    fontWeight: clamped < 0.4 ? 500 : clamped < 0.75 ? 700 : 900,
    paddingBlock: 10 + clamped * 4, // 10~14px
    paddingInline: 18 + clamped * 10, // 18~28px
  };
}

interface TagBox {
  width: number;
  height: number;
}

interface Placement {
  left: number;
  top: number;
}

/** 태그 텍스트의 렌더링 크기를 실제 DOM 측정 없이 대략 추정한다(배치를 렌더 전에
 * 미리 계산해야 해서). 한글은 폭이 정사각형에 가까워 글자수 * 폰트크기 근사가 잘 맞는다. */
function estimateTagBox(text: string, tag: TagStyle): TagBox {
  return {
    width: text.length * tag.fontSize * 1.05 + tag.paddingInline * 2,
    height: tag.fontSize * 1.3 + tag.paddingBlock * 2,
  };
}

function rectsOverlap(a: Placement & TagBox, b: Placement & TagBox, gap: number): boolean {
  return !(
    a.left + a.width + gap < b.left ||
    b.left + b.width + gap < a.left ||
    a.top + a.height + gap < b.top ||
    b.top + b.height + gap < a.top
  );
}

const PACK_MARGIN = 12;
const PACK_GAP = 40;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

const GOLDEN_ANGLE = 2.399963;
/** 가로로 넓은 카드 비율에 맞춰 세로 반지름을 눌러주는 배율. */
const RADIUS_SQUASH = 0.72;

/** 태그마다 목표 반지름을 sqrt(순서 비율)로 정해 중심부터 바깥까지 "단위 면적당 밀도"가
 * 균등하도록 펼친다(해바라기씨 배열의 원리 — 반지름을 그냥 선형으로 늘리면 안쪽 원일수록
 * 둘레가 짧아서 점들이 중심에 몰려 보인다). 중요도가 큰(=먼저 처리되는) 태그일수록 안쪽
 * 링에 배정되지만, 전체적으로는 컨테이너 전체 면적에 고루 퍼진다 — 중심에 뭉치지 않는다.
 * 각 태그는 자기 목표 반지름 근처에서만 국소적으로 나선 탐색해 겹침을 피한다(탐색이 다시
 * 중심으로 끌려가면 균등 분포가 깨지므로, 중심이 아니라 목표 지점 기준으로 탐색한다).
 *
 * 어떤 경우에도 컨테이너 경계 안으로 clamp한다 — 이 앱은 모바일에서 사이드바가 접히지 않아
 * 카드 폭이 태그 하나보다 좁아지는 극단적인 경우가 실제로 있고(실측 142px), 그럴 때 탐색이
 * 다 실패하면 안 잡힌 좌표를 그대로 쓰면 태그가 화면 밖으로 날아가 버린다. clamp하면 그런
 * 극단적인 경우 태그끼리 살짝 겹칠 순 있지만, 최소한 항상 보인다. */
function packCentered(boxes: TagBox[], containerW: number, containerH: number): Placement[] {
  const cx = containerW / 2;
  const cy = containerH / 2;
  const maxRadius = Math.max(
    0,
    Math.min(containerW / 2 - PACK_MARGIN, (containerH / 2 - PACK_MARGIN) / RADIUS_SQUASH),
  );
  const placed: (Placement & TagBox)[] = [];

  const clampToBounds = (left: number, top: number, box: TagBox): Placement => ({
    left: clamp(left, PACK_MARGIN, Math.max(PACK_MARGIN, containerW - box.width - PACK_MARGIN)),
    top: clamp(top, PACK_MARGIN, Math.max(PACK_MARGIN, containerH - box.height - PACK_MARGIN)),
  });

  return boxes.map((box, i) => {
    const t = boxes.length <= 1 ? 0 : i / (boxes.length - 1);
    const targetRadius = Math.sqrt(t) * maxRadius;
    const baseAngle = i * GOLDEN_ANGLE;

    let angle = baseAngle;
    let radius = targetRadius;
    let result: Placement = clampToBounds(
      cx + radius * Math.cos(angle) - box.width / 2,
      cy + radius * Math.sin(angle) * RADIUS_SQUASH - box.height / 2,
      box,
    );

    for (let step = 0; step < 800; step++) {
      const left = cx + radius * Math.cos(angle) - box.width / 2;
      const top = cy + radius * Math.sin(angle) * RADIUS_SQUASH - box.height / 2;
      const candidate = { left, top, width: box.width, height: box.height };
      const inBounds =
        left >= PACK_MARGIN &&
        top >= PACK_MARGIN &&
        left + box.width <= containerW - PACK_MARGIN &&
        top + box.height <= containerH - PACK_MARGIN;
      const collides = placed.some((p) => rectsOverlap(candidate, p, PACK_GAP));
      result = clampToBounds(left, top, box);
      if (inBounds && !collides) {
        placed.push(candidate);
        return result;
      }
      // 목표 반지름 근처를 나선형으로 살짝만 넓혀가며 탐색한다 — 시작점 자체가 이미
      // 자기 링 위치라, 겹칠 때만 거기서부터 조금씩 더 바깥으로 밀려난다.
      angle += 0.42;
      radius = targetRadius + (step + 1) * 1.6;
    }
    placed.push({ ...result, width: box.width, height: box.height });
    return result;
  });
}

export default function KeywordCloud({ items, history }: Props) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [related, setRelated] = useState<RelatedCategoryItem[] | null>(null);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [relatedError, setRelatedError] = useState(false);

  // 태그 크기/굵기 계산용 정규화 범위. 1위(앵커)는 popularity_index가 항상 100 근처로
  // 압도적으로 커서, 나머지가 전부 최소 크기 근처로 뭉쳐 보이지 않도록 나머지 항목들의
  // 범위만으로 정규화한다(1위 자체는 별도로 최대 크기를 고정 적용).
  const importanceRange = useMemo(() => {
    const rest = items.filter((item) => item.rank !== 1);
    const values = (rest.length > 0 ? rest : items).map((item) => item.popularity_index);
    const maxIndex = Math.max(...values, 1);
    const minIndex = Math.min(...values, 0);
    return { minIndex, spread: maxIndex - minIndex || 1 };
  }, [items]);

  const tags = useMemo(
    () =>
      items.map((item) => {
        const t = (item.popularity_index - importanceRange.minIndex) / importanceRange.spread;
        const style = tagStyle(t);
        return { item, style, box: estimateTagBox(item.category_name, style) };
      }),
    [items, importanceRange],
  );

  // 배치 계산엔 컨테이너의 실제 픽셀 크기가 필요하다(반응형이라 고정값을 쓸 수 없음).
  // useLayoutEffect로 첫 페인트 전에 동기 측정해서, "가운데 뭉쳐있다가 흩어지는" 첫 프레임
  // 깜빡임 없이 바로 최종 위치로 그려지게 한다. 이후 리사이즈는 ResizeObserver가 갱신한다.
  const cloudRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = cloudRef.current;
    if (!el) return;
    setContainerSize({ width: el.clientWidth, height: el.clientHeight });
  }, []);

  useEffect(() => {
    const el = cloudRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box) setContainerSize({ width: box.width, height: box.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const placements = useMemo(() => {
    if (containerSize.width === 0 || containerSize.height === 0) return [];
    return packCentered(
      tags.map((t) => t.box),
      containerSize.width,
      containerSize.height,
    );
  }, [tags, containerSize]);

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
  const yearBoundaryIdx = useMemo(
    () => (selectedSeries ? findYearBoundaryIndex(selectedSeries.values) : null),
    [selectedSeries],
  );

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
      <div className={styles.cloudOuter}>
        <div className={styles.cloud} ref={cloudRef}>
          {tags.map(({ item, style }, i) => {
            const isSelected = selectedIdx === i;
            const placement = placements[i];
            return (
              <button
                key={item.category_name}
                type="button"
                className={[styles.keyword, isSelected ? styles.selected : ""].join(" ")}
                style={{
                  // 측정 전(첫 프레임)엔 placement가 없다 — 보이지 않게 숨겨서 중앙에
                  // 뭉쳐있는 잘못된 위치가 잠깐 노출되는 걸 막는다.
                  visibility: placement ? "visible" : "hidden",
                  left: `${placement?.left ?? 0}px`,
                  top: `${placement?.top ?? 0}px`,
                  fontSize: `${style.fontSize}px`,
                  fontWeight: style.fontWeight,
                  paddingBlock: `${style.paddingBlock}px`,
                  paddingInline: `${style.paddingInline}px`,
                  // 진입 애니메이션을 순서대로 살짝 엇갈리게 — 무작위가 아니라 인덱스 기반이라
                  // 리렌더돼도 항상 같은 순서로 나타난다.
                  animationDelay: `${i * 40}ms`,
                }}
                aria-pressed={isSelected}
                onClick={() => setSelectedIdx(isSelected ? null : i)}
              >
                {item.category_name}
              </button>
            );
          })}
        </div>
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
                <span className={styles.relatedMetricLabel}>매출 증감</span>
                <span className={styles.relatedMetricValue}>
                  <TrendValue value={selected.qoq_sales_change_pct} format={fmtPctMagnitude} />
                </span>
              </span>
              <span className={styles.relatedMetric}>
                <span className={styles.relatedMetricLabel}>핵심 수요층</span>
                <span className={styles.relatedMetricValue}>{selected.core_age_group ?? "—"}</span>
              </span>
            </div>

            {selected.rank !== 1 && (
              <div className={styles.sparkSection}>
                {selectedSeries && selectedSeries.values.length > 0 ? (
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
                            {formatMonthLabel(
                              selectedSeries.values[hoverIdx].period,
                              selectedSeries.values[selectedSeries.values.length - 1].period.slice(0, 4),
                            )}
                          </span>
                          <span className={styles.sparkTooltipValue}>
                            검색지수 {selectedSeries.values[hoverIdx].popularity_index.toFixed(1)}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className={styles.sparkTicks}>
                      <span
                        className={styles.sparkTickStart}
                        style={{ left: `${(sparkPoints[0].x / SPARK_W) * 100}%` }}
                      >
                        {formatMonthLabel(
                          selectedSeries.values[0].period,
                          selectedSeries.values[selectedSeries.values.length - 1].period.slice(0, 4),
                        )}
                      </span>
                      {yearBoundaryIdx != null && (
                        <span
                          className={styles.sparkTickMid}
                          style={{ left: `${(sparkPoints[yearBoundaryIdx].x / SPARK_W) * 100}%` }}
                        >
                          {formatMonthLabel(selectedSeries.values[yearBoundaryIdx].period, undefined, true)}
                        </span>
                      )}
                      <span
                        className={styles.sparkTickEnd}
                        style={{ left: `${(sparkPoints[sparkPoints.length - 1].x / SPARK_W) * 100}%` }}
                      >
                        {formatMonthLabel(selectedSeries.values[selectedSeries.values.length - 1].period)}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className={styles.sparkEmpty}>이 업종의 추이 데이터가 부족해요.</div>
                )}
              </div>
            )}
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
                      <span className={styles.relatedMetric}>
                        <span className={styles.relatedMetricLabel}>매출 증감</span>
                        <span className={styles.relatedMetricValue}>
                          <TrendValue value={item.qoq_sales_change_pct} format={fmtPctMagnitude} />
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
