import GangnamForecastChart from "../charts/GangnamForecastChart";
import type { ForecastPoint } from "../charts/ForecastChart";
import type { TimeseriesPoint } from "../../types";
import { fmtPct, fmtInt } from "./format";
import styles from "./SurvivalCard.module.css";

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
}: SurvivalCardProps) {
  const hist = history ?? [];
  const fc = forecastSeries ?? [];
  const hasChart = hist.length + fc.length >= 2;
  const deltaUp = (delta ?? 0) >= 0;

  // 용어 없이 이해되는 부제: "2025년 4분기에 창업하면 2026년 4분기엔 100곳 중 88곳이 남아요".
  const startLabel = fmtQuarter(hist[0]?.year_quarter);
  const endLabel = fmtQuarter(fc[fc.length - 1]?.year_quarter);
  const survivors = forecast != null ? Math.round(forecast) : null;
  const subtitle =
    startLabel && endLabel && survivors != null
      ? `${startLabel}에 창업하면 ${endLabel}엔 100곳 중 ${survivors}곳이 남아요`
      : "창업 시점 대비 살아남는 점포 비율(ML 예측)";

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
        {onExpand && hasChart && (
          <button type="button" className={styles.expandBtn} onClick={onExpand} aria-label="생존율 예측 확대">
            ⤢
          </button>
        )}
      </div>

      <div className={styles.body}>
        <div className={styles.left}>
          <div className={styles.hero}>
            <span className={styles.heroNow}>{fmtPct(current, 0)}</span>
            <span className={styles.arrow}>→</span>
            <span className={styles.heroNext}>{fmtPct(forecast, 0)}</span>
          </div>
          {delta != null && (
            <span className={styles.deltaPill}>
              {deltaUp ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%p · 4분기 후 전망
            </span>
          )}
        </div>

        <div className={styles.stats}>
          <div className={styles.statBox}>
            <span className={styles.statLabel}>현재 매장수</span>
            <span className={styles.statValue}>{fmtInt(totalBusiness)}</span>
          </div>
          <div className={styles.statBox}>
            <span className={styles.statLabel}>폐업률</span>
            <span className={styles.statValue}>{fmtPct(closureRate, 1)}</span>
          </div>
          <div className={styles.statBox}>
            <span className={styles.statLabel}>4분기 후 전망</span>
            <span className={styles.statValueAccent}>
              {fmtPct(forecast, 0)} {delta != null && `${deltaUp ? "▲" : "▼"}${Math.abs(delta).toFixed(1)}%p`}
            </span>
          </div>
        </div>
      </div>

      {hasChart ? (
        <div className={styles.chart}>
          <GangnamForecastChart
            history={hist}
            forecast={fc}
            unit="ratio"
            onScenarioClick={onScenarioClick}
            height={240}
            yDomain={yDomain}
            endLabels
          />
        </div>
      ) : (
        <div className={styles.empty}>예측 데이터가 없어요.</div>
      )}
    </div>
  );
}
