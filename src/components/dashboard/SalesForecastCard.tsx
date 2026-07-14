import { lazy, Suspense } from "react";
import type { TimeseriesPoint } from "../../types";
import { fmtEok } from "./format";
import PageLoader from "../common/PageLoader";
import styles from "./SalesForecastCard.module.css";

const GangnamForecastChart = lazy(() => import("../charts/GangnamForecastChart"));

interface SalesForecastCardProps {
  /** 직전 분기 실적 앵커(보통 1점). 세 시나리오가 모두 이 점에서 출발한다. */
  history?: TimeseriesPoint[];
  /** 예측 시계열(value=분기 총매출 원, low/high 신뢰구간). */
  forecast: TimeseriesPoint[];
  /** 헤더에 표기할 대상(예: "전체 상권" 또는 선택 업종명). */
  categoryLabel: string;
  /** 업종 예측이 없을 때 안내 문구. 있으면 차트 대신 표시. */
  fallbackNote?: string | null;
}

/** 업종/상권 매출 예측 카드. 생존율 카드의 업종 선택과 연동되어 같은 대상의 매출 곡선을 보여준다. */
export default function SalesForecastCard({ history = [], forecast, categoryLabel, fallbackNote }: SalesForecastCardProps) {
  const hasChart = !fallbackNote && forecast.length >= 2;
  const first = forecast[0]?.value ?? null;
  const last = forecast[forecast.length - 1]?.value ?? null;
  const delta =
    first != null && last != null && first !== 0
      ? Number((((last - first) / first) * 100).toFixed(1))
      : null;
  const deltaUp = (delta ?? 0) >= 0;

  // Y축을 데이터 범위로 좁혀 곡선이 눌리지 않게(신뢰구간 하한~상한 여유). 앵커(실적)값도 포함해 시작점이 잘리지 않게.
  const vals = [...history, ...forecast]
    .flatMap((p) => [p.value, p.low ?? null, p.high ?? null])
    .filter((v): v is number => v != null);
  const yDomain: [number, number] | undefined =
    vals.length > 0 ? [Math.min(...vals) * 0.9, Math.max(...vals) * 1.05] : undefined;

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <div>
          <h3 className={styles.title}>매출 예측</h3>
          <p className={styles.sub}>{categoryLabel} · 향후 4분기 총매출 전망(ML)</p>
        </div>
      </div>

      {fallbackNote ? (
        <p className={styles.fallbackNote}>{fallbackNote}</p>
      ) : (
        <>
          <div className={styles.hero}>
            <span className={styles.heroNow}>{fmtEok(first)}</span>
            <span className={styles.arrow}>→</span>
            <span className={styles.heroNext}>{fmtEok(last)}</span>
            {delta != null && (
              <span className={`${styles.deltaPill} ${deltaUp ? styles.deltaUp : styles.deltaDown}`}>
                {deltaUp ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}% · 4분기 후
              </span>
            )}
          </div>

          {hasChart ? (
            <div className={styles.chart}>
              <Suspense fallback={<PageLoader fullScreen={false} />}>
                <GangnamForecastChart history={history} forecast={forecast} unit="won" height={220} yDomain={yDomain} endLabels />
              </Suspense>
            </div>
          ) : (
            <p className={styles.fallbackNote}>매출 예측 데이터가 아직 없습니다.</p>
          )}
        </>
      )}
    </div>
  );
}
