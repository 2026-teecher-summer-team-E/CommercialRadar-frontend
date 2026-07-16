import { useEffect, useMemo, useState } from "react";
import { useSearchTrendRanking } from "../../hooks/queries";
import styles from "../../pages/LandingPage.module.css";
import { LATEST_REPORTS, RISING_DISTRICTS, TREND_INDUSTRIES } from "./data";
import { DownloadIcon } from "./icons";

/** 검색 관심도 변화율(%)을 +/- 부호가 붙은 정수 배지 문자열로 포맷. */
function formatDelta(value: number): string {
  return `${value >= 0 ? "+" : ""}${Math.round(value)}%`;
}

/** 다운로드 클릭 후 토스트가 표시되는 시간(ms). */
const TOAST_DURATION = 2500;

/** 지금 이 순간, 뜨는 상권: 급상승 상권 / 트렌드 업종 / 최신 리포트. */
export default function RisingSection() {
  // 트렌드 업종은 검색 관심도 변화율 랭킹 실데이터로 채우고, 로딩·에러 시엔 하드코딩으로 폴백한다.
  const { data: trendData } = useSearchTrendRanking({ limit: 10 });
  const trendIndustries = useMemo(() => {
    const items = trendData?.ranking;
    if (!items?.length) return TREND_INDUSTRIES;
    return [...items]
      .sort((a, b) => b.trend_pct - a.trend_pct)
      .slice(0, 5)
      .map((it) => ({ name: it.category_name, delta: formatDelta(it.trend_pct) }));
  }, [trendData]);

  // 리포트 다운로드 클릭 피드백용 토스트. tick 을 올려 같은 버튼 연타 시에도 타이머를 재설정한다.
  const [toastTick, setToastTick] = useState(0);
  useEffect(() => {
    if (toastTick === 0) return;
    const timer = setTimeout(() => setToastTick(0), TOAST_DURATION);
    return () => clearTimeout(timer);
  }, [toastTick]);

  return (
    <section className={styles.rising}>
      <div className={styles.container}>
        <div className={styles.sectionHead}>
          <h2 className={styles.h2}>실시간 상권 및 업종 트렌드</h2>
          <p className={styles.sectionSub}>
            공공데이터와 카드사 매출 데이터 기반으로 매주 업데이트됩니다.
          </p>
        </div>

        <div className={styles.risingGrid}>
          <div className={styles.panel}>
            <h3 className={styles.panelTitle}>이번 주 급상승 상권</h3>
            <ol className={styles.rankList}>
              {RISING_DISTRICTS.map((item, i) => (
                <li key={item.name} className={styles.rankRow}>
                  <span className={styles.rankNo}>{i + 1}</span>
                  <div className={styles.rankBody}>
                    <div className={styles.rankLine}>
                      <span className={styles.rankName}>{item.name}</span>
                      <span className={styles.rankRight}>
                        <span className={styles.rankSub}>{item.sub}</span>
                        <span className={styles.rankDelta}>{item.delta}</span>
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className={styles.panel}>
            <h3 className={styles.panelTitle}>요즘 창업 트렌드 업종</h3>
            <ol className={styles.rankList}>
              {trendIndustries.map((item, i) => (
                <li key={item.name} className={styles.rankRow}>
                  <span className={styles.rankNo}>{i + 1}</span>
                  <div className={styles.rankBody}>
                    <div className={styles.rankLine}>
                      <span className={styles.rankName}>{item.name}</span>
                      <span className={styles.rankDelta}>{item.delta}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className={styles.panel}>
            <h3 className={styles.panelTitle}>최신 리포트</h3>
            <ul className={styles.reportList}>
              {LATEST_REPORTS.map((report) => (
                <li key={report.title} className={styles.reportItem}>
                  <div className={styles.reportTop}>
                    <span className={styles.reportTitle}>{report.title}</span>
                    {report.hot && <span className={styles.hotBadge}>HOT</span>}
                  </div>
                  <div className={styles.reportMeta}>
                    <span className={styles.reportDate}>{report.meta}</span>
                    <button
                      type="button"
                      className={styles.downloadLink}
                      onClick={() => setToastTick((t) => t + 1)}
                    >
                      <DownloadIcon size={10} />
                      다운로드
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {toastTick > 0 && (
        <div className={styles.toast} role="status" aria-live="polite">
          <DownloadIcon size={14} />
          다운로드를 시작합니다.
        </div>
      )}
    </section>
  );
}
