import GangnamForecastChart from "../charts/GangnamForecastChart";
import type { ForecastPoint } from "../charts/ForecastChart";
import type { TimeseriesPoint } from "../../types";
import { useCountUp } from "../../hooks/useCountUp";
import { fmtPct, fmtInt } from "./format";
import { ExpandIcon } from "../landing/icons";
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

  // 히어로 숫자 카운트업: 현재값 먼저, 전망값은 살짝 늦게 올라와 '현재→전망' 흐름을 만든다.
  const animCurrent = useCountUp(current, { duration: 900 });
  const animForecast = useCountUp(forecast, { duration: 900, delay: 450 });

  // 용어 없이 이해되는 부제: "2025년 4분기에 창업하면 2026년 4분기엔 100곳 중 88곳이 남아요".
  const startLabel = fmtQuarter(hist[0]?.year_quarter);
  const endLabel = fmtQuarter(fc[fc.length - 1]?.year_quarter);
  const survivors = forecast != null ? Math.round(forecast) : null;
  const subtitle =
    startLabel && endLabel && survivors != null
      ? `100곳이 문 열면 ${survivors}곳이 버팁니다 — ${startLabel} 창업 기준`
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
            <ExpandIcon />
          </button>
        )}
      </div>

      <div className={styles.body}>
        <div className={styles.left}>
          <div className={styles.hero}>
            <span className={styles.heroNow}>{fmtPct(animCurrent, 0)}</span>
            <span className={styles.arrow}>→</span>
            <span className={styles.heroNext}>{fmtPct(animForecast, 0)}</span>
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
            sequentialDraw
          />
          {onScenarioClick && (
            <div className={styles.scenarioBar}>
              <span className={styles.scenarioHint}>미래 거리 미리보기</span>
              <div className={styles.scenarioBtns}>
                <button
                  type="button"
                  className={`${styles.scenarioBtn} ${styles.scenarioBtnHigh}`}
                  onClick={() => onScenarioClick("high")}
                  aria-label="잘풀린 미래 시뮬레이션 열기"
                >
                  <span className={styles.scenarioDot} style={{ background: "#16a34a" }} />
                  잘풀린 미래
                </button>
                <button
                  type="button"
                  className={`${styles.scenarioBtn} ${styles.scenarioBtnMid}`}
                  onClick={() => onScenarioClick("mid")}
                  aria-label="보통 미래 시뮬레이션 열기"
                >
                  <span className={styles.scenarioDot} style={{ background: "#2563eb" }} />
                  보통 미래
                </button>
                <button
                  type="button"
                  className={`${styles.scenarioBtn} ${styles.scenarioBtnLow}`}
                  onClick={() => onScenarioClick("low")}
                  aria-label="안풀린 미래 시뮬레이션 열기"
                >
                  <span className={styles.scenarioDot} style={{ background: "#dc2626" }} />
                  안풀린 미래
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className={styles.empty}>예측에 필요한 분기 데이터가 부족합니다.</div>
      )}
    </div>
  );
}
