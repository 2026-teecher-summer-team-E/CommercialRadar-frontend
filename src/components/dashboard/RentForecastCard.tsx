import { lazy, Suspense } from "react";
import type { TimeseriesPoint } from "../../types";
import PageLoader from "../common/PageLoader";
import styles from "./RentForecastCard.module.css";

const GangnamForecastChart = lazy(() => import("../charts/GangnamForecastChart"));

interface RentForecastCardProps {
  /** 직전 분기 실적 앵커(보통 1점, 중대형 기준 ㎡당 임대료). */
  history?: TimeseriesPoint[];
  /** 예측 시계열(값=㎡당 임대료 원, low/high 신뢰구간). */
  forecast: TimeseriesPoint[];
  /** 헤더에 표기할 대상(예: "중대형 상가"). */
  floorTypeLabel: string;
  /** 예측이 없을 때 안내 문구. 있으면 차트 대신 표시. */
  fallbackNote?: string | null;
}

/** 원 → ₩ + 천단위 콤마(예: ₩85,203). null 이면 "—". */
function fmtWon(won: number | null | undefined): string {
  if (won == null) return "—";
  return `₩${Math.round(won).toLocaleString("ko-KR")}`;
}

/** 임대료 예측 카드. 매출 예측 카드와 같은 톤(실적 앵커 → 향후 4분기 시나리오 밴드)으로 ㎡당 임대료 추이를 보여준다. */
export default function RentForecastCard({ history = [], forecast, floorTypeLabel, fallbackNote }: RentForecastCardProps) {
  const hasChart = !fallbackNote && forecast.length >= 1 && (history.length > 0 || forecast.length >= 2);
  const first = history[0]?.value ?? forecast[0]?.value ?? null;
  const last = forecast[forecast.length - 1]?.value ?? null;
  const delta =
    first != null && last != null && first !== 0
      ? Number((((last - first) / first) * 100).toFixed(1))
      : null;
  const deltaUp = (delta ?? 0) >= 0;

  // Y축을 데이터 범위로 좁혀 곡선이 눌리지 않게(신뢰구간 하한~상한 여유). 앵커(실적)값도 포함해 시작점이 잘리지 않게.
  // 여백은 '절대값 비율'(min×0.9 등)이 아니라 '데이터 폭 비율'로 잡는다 — 임대료는 값이 커서(13만대)
  // 절대값 기준이면 위/아래가 과하게 비어 보였다. 폭의 12%(평평하면 값의 2%)만 위아래로 둔다.
  const vals = [...history, ...forecast]
    .flatMap((p) => [p.value, p.low ?? null, p.high ?? null])
    .filter((v): v is number => v != null);
  const yDomain: [number, number] | undefined = (() => {
    if (vals.length === 0) return undefined;
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const pad = Math.max((hi - lo) * 0.12, hi * 0.02);
    return [lo - pad, hi + pad];
  })();

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <div>
          <h3 className={styles.title}>임대료 예측</h3>
          <p className={styles.sub}>{floorTypeLabel} · 향후 4분기 ㎡당 임대료 전망(ML)</p>
        </div>
      </div>

      {fallbackNote ? (
        <p className={styles.fallbackNote}>{fallbackNote}</p>
      ) : (
        <>
          <div className={styles.hero}>
            <span className={styles.heroNow}>{fmtWon(first)}</span>
            <span className={styles.arrow}>→</span>
            <span className={styles.heroNext}>{fmtWon(last)}</span>
            {delta != null && (
              <span className={`${styles.deltaPill} ${deltaUp ? styles.deltaUp : styles.deltaDown}`}>
                {deltaUp ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}% · 4분기 후
              </span>
            )}
          </div>

          {hasChart ? (
            <div className={styles.chart}>
              <Suspense fallback={<PageLoader fullScreen={false} />}>
                <GangnamForecastChart history={history} forecast={forecast} unit="won_sqm" height={220} yDomain={yDomain} endLabels />
              </Suspense>
            </div>
          ) : (
            <p className={styles.fallbackNote}>임대료 예측 데이터가 아직 없습니다.</p>
          )}
        </>
      )}
    </div>
  );
}
