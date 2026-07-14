import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { ForecastPoint } from "../charts/ForecastChart";
import type { TimeseriesPoint } from "../../types";
import { useCountUp } from "../../hooks/useCountUp";
import { fmtPct, fmtInt } from "./format";
import PageLoader from "../common/PageLoader";
import styles from "./SurvivalCard.module.css";

// recharts가 들어있어 무거움 — 카드가 실제로 차트를 그릴 때만 로드.
const GangnamForecastChart = lazy(() => import("../charts/GangnamForecastChart"));

interface SurvivalCardProps {
  /** 현재(첫) 생존율 %. */
  current: number | null;
  /** 전망(끝) 생존율 %. */
  forecast: number | null;
  /** Δ %p (전망 - 현재). */
  delta: number | null;
  /** 레거시 prop(미사용). 시그니처 호환용. */
  points?: ForecastPoint[];
  /** 실적 시계열(0~1 스케일). */
  history?: TimeseriesPoint[];
  /** 예측 시계열(0~1 스케일). */
  forecastSeries?: TimeseriesPoint[];
  /** 시나리오 선(low/mid/high) 클릭 콜백. */
  onScenarioClick?: (s: "low" | "mid" | "high") => void;
  totalBusiness: number | null;
  closureRate: number | null;
  onExpand?: () => void;
  /** 업종 선택 옵션(첫 항목 = 전체 상권). */
  categoryOptions?: string[];
  /** 선택된 업종(null = 전체 상권). */
  selectedCategory?: string | null;
  /** 업종 변경 콜백(전체 상권 선택 시 null). */
  onCategoryChange?: (category: string | null) => void;
  /** 폴백 안내 문구. 있으면 예측 대신 현재 생존율만 표시. */
  fallbackNote?: string | null;
}

/** 업종 드롭다운 '전체 상권' 옵션 값. */
const ALL_CATEGORIES = "__all__";

interface CategoryDropdownProps {
  options: string[];
  selected: string | null;
  onChange: (category: string | null) => void;
}

/**
 * 업종 선택 커스텀 드롭다운.
 * 네이티브 <select>는 열린 목록을 CSS로 스타일할 수 없어(OS 기본 UI),
 * 서비스 톤에 맞춘 트리거 버튼 + 메뉴로 직접 구현한다.
 */
function CategoryDropdown({ options, selected, onChange }: CategoryDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const items = [{ value: ALL_CATEGORIES, label: "전체 상권" }, ...options.map((c) => ({ value: c, label: c }))];

  return (
    <div className={styles.categoryWrap} ref={ref}>
      <span className={styles.categoryLabel}>업종</span>
      <button
        type="button"
        className={styles.categoryTrigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="업종 선택"
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.categoryValue}>{selected ?? "전체 상권"}</span>
        <svg className={styles.categoryChevron} width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path
            d="M2.5 4.5 6 8l3.5-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <ul className={styles.categoryMenu} role="listbox">
          {items.map((it) => {
            const isSel = (it.value === ALL_CATEGORIES ? null : it.value) === selected;
            return (
              <li key={it.value} role="option" aria-selected={isSel}>
                <button
                  type="button"
                  className={`${styles.categoryOption} ${isSel ? styles.categoryOptionSel : ""}`}
                  onClick={() => {
                    onChange(it.value === ALL_CATEGORIES ? null : it.value);
                    setOpen(false);
                  }}
                >
                  {it.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** "2025-Q4" → "2025년 4분기". 파싱 실패 시 원본 반환. */
function fmtQuarter(q?: string | null): string | null {
  if (!q) return null;
  const m = q.match(/(\d{4})[-\s]?Q?([1-4])/i);
  return m ? `${m[1]}년 ${m[2]}분기` : q;
}

/** 생존율 예측 카드. Figma 2262:3603 재현. */
export default function SurvivalCard({
  current,
  forecast,
  delta,
  history,
  forecastSeries,
  onScenarioClick,
  totalBusiness,
  closureRate,
  onExpand,
  categoryOptions,
  selectedCategory,
  onCategoryChange,
  fallbackNote,
}: SurvivalCardProps) {
  const hist = history ?? [];
  const fc = forecastSeries ?? [];
  const isFallback = fallbackNote != null;
  const hasChart = !isFallback && hist.length + fc.length >= 2;
  const deltaUp = (delta ?? 0) >= 0;

  // 히어로 숫자 카운트업: 현재값 먼저, 전망값은 살짝 늦게 올라와 '현재→전망' 흐름을 만든다.
  const animCurrent = useCountUp(current, { duration: 900 });
  const animForecast = useCountUp(forecast, { duration: 900, delay: 450 });

  // 용어 없이 이해되는 부제: "2025년 4분기에 창업하면 2026년 4분기엔 100곳 중 88곳이 남아요".
  const startLabel = fmtQuarter(hist[0]?.year_quarter);
  const endLabel = fmtQuarter(fc[fc.length - 1]?.year_quarter);
  const survivors = forecast != null ? Math.round(forecast) : null;
  const subtitle = isFallback
    ? "현재 생존율(최근 분기 실측)"
    : startLabel && endLabel && survivors != null
      ? `100곳이 문 열면 ${survivors}곳이 버팁니다 — ${startLabel} 창업 기준`
      : "창업 시점 대비 살아남는 점포 비율(ML 예측)";

  const hasCategorySelect = categoryOptions != null && categoryOptions.length > 0 && onCategoryChange != null;

  // Y축을 데이터 범위(최저값~100%)로 좁혀 곡선이 눌리지 않게. 최저값을 0.05 단위로 내림.
  const vals = [...hist, ...fc]
    .flatMap((p) => [p.value, p.low ?? null, p.high ?? null])
    .filter((v): v is number => v != null);
  const yDomain: [number, number] | undefined =
    vals.length > 0 ? [Math.max(0, Math.floor(Math.min(...vals) * 20) / 20), 1] : undefined;

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <div>
          <h3 className={styles.title}>생존율 예측</h3>
          <p className={styles.sub}>{subtitle}</p>
        </div>
        <div className={styles.headRight}>
          {hasCategorySelect && (
            <CategoryDropdown
              options={categoryOptions}
              selected={selectedCategory ?? null}
              onChange={(c) => onCategoryChange?.(c)}
            />
          )}
          {onExpand && hasChart && (
            <button type="button" className={styles.expandBtn} onClick={onExpand} aria-label="생존율 예측 확대">
              ⤢
            </button>
          )}
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.left}>
          {isFallback ? (
            <div className={styles.hero}>
              <span className={styles.heroNow}>{fmtPct(animCurrent, 0)}</span>
            </div>
          ) : (
            <div className={styles.hero}>
              <span className={styles.heroNow}>{fmtPct(animCurrent, 0)}</span>
              <span className={styles.arrow}>→</span>
              <span className={styles.heroNext}>{fmtPct(animForecast, 0)}</span>
            </div>
          )}
          {isFallback ? (
            <p className={styles.fallbackNote}>{fallbackNote}</p>
          ) : (
            delta != null && (
              <span className={styles.deltaPill}>
                {deltaUp ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%p · 4분기 후 전망
              </span>
            )
          )}
        </div>

        <div className={styles.stats}>
          <div className={`${styles.statBox} ${styles.statBoxRow}`}>
            <div className={styles.statPair}>
              <span className={styles.statLabel}>현재 매장수</span>
              <span className={styles.statValue}>{fmtInt(totalBusiness)}</span>
            </div>
            <span className={styles.statDivider} aria-hidden="true" />
            <div className={styles.statPair}>
              <span className={styles.statLabel}>폐업률</span>
              <span className={styles.statValue}>{fmtPct(closureRate, 1)}</span>
            </div>
          </div>
        </div>
      </div>

      {hasChart ? (
        <div className={styles.chart}>
          <Suspense fallback={<PageLoader fullScreen={false} />}>
            <GangnamForecastChart
              history={hist}
              forecast={fc}
              unit="ratio"
              onScenarioClick={onScenarioClick}
              height={270}
              yDomain={yDomain}
              endLabels
              sequentialDraw
            />
          </Suspense>
          {onScenarioClick && (
            <div className={styles.scenarioBar}>
              <span className={styles.scenarioHint}>상권 앞 분위기 시뮬레이션</span>
              <div className={styles.scenarioBtns}>
                <button
                  type="button"
                  className={`${styles.scenarioBtn} ${styles.scenarioBtnHigh}`}
                  onClick={() => onScenarioClick("high")}
                  aria-label="잘풀린 미래 시뮬레이션 열기"
                >
                  <span className={styles.scenarioDot} style={{ background: "var(--color-green)" }} />
                  잘풀린 미래
                </button>
                <button
                  type="button"
                  className={`${styles.scenarioBtn} ${styles.scenarioBtnMid}`}
                  onClick={() => onScenarioClick("mid")}
                  aria-label="보통 미래 시뮬레이션 열기"
                >
                  <span className={styles.scenarioDot} style={{ background: "var(--series-1)" }} />
                  보통 미래
                </button>
                <button
                  type="button"
                  className={`${styles.scenarioBtn} ${styles.scenarioBtnLow}`}
                  onClick={() => onScenarioClick("low")}
                  aria-label="안풀린 미래 시뮬레이션 열기"
                >
                  <span className={styles.scenarioDot} style={{ background: "var(--color-red)" }} />
                  안풀린 미래
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        !isFallback && <div className={styles.empty}>예측 데이터가 없어요.</div>
      )}
    </div>
  );
}
