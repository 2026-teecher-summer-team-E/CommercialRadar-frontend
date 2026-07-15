import { useEffect, useMemo, useState } from "react";
import { commercialApi } from "../services/commercialApi";
import type {
  CategorySearchTrendRankingResponse,
  PopularCategoriesResponse,
  PopularityHistoryResponse,
} from "../types";
import KeywordCloud from "../components/trends/KeywordCloud";
import CategoryRaceChart from "../components/trends/CategoryRaceChart";
import TrendValue from "../components/trends/TrendValue";
import { fmtCountMagnitude, fmtIndex, fmtPctMagnitude } from "../components/trends/trendsFormat";
import styles from "./TrendsPage.module.css";

const KEYWORD_LIMIT = 6;
/** 백엔드가 반환 가능한 업종 전체 수만큼 요청해 rising/sinking을 클라이언트에서 양끝으로 슬라이스한다. */
const RANKING_FETCH_LIMIT = 100;
const POPULAR_LIMIT = 9;
/** --series-1~7(앱 전역 차트 팔레트) 크기만큼만 — 바 차트 레이스는 색상으로 업종을 구분한다. */
const RACE_LIMIT = 7;

export default function TrendsPage() {
  const [ranking, setRanking] = useState<CategorySearchTrendRankingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [popular, setPopular] = useState<PopularCategoriesResponse | null>(null);
  const [popularLoading, setPopularLoading] = useState(true);
  const [popularError, setPopularError] = useState(false);

  const [history, setHistory] = useState<PopularityHistoryResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState(false);
  /** null이면 "아직 안 골랐음" — 백엔드가 골라준 최신 연도를 응답에서 받아 채운다. */
  const [selectedYear, setSelectedYear] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(false);

    commercialApi
      .searchTrendRanking({ limit: RANKING_FETCH_LIMIT })
      .then((res) => {
        if (!alive) return;
        setRanking(res.data);
      })
      .catch(() => {
        if (alive) setError(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    setPopularLoading(true);
    setPopularError(false);

    commercialApi
      .popularCategories({ limit: POPULAR_LIMIT })
      .then((res) => {
        if (!alive) return;
        setPopular(res.data);
      })
      .catch(() => {
        if (alive) setPopularError(true);
      })
      .finally(() => {
        if (alive) setPopularLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    setHistoryLoading(true);
    setHistoryError(false);

    commercialApi
      .popularityHistory({ limit: RACE_LIMIT, year: selectedYear ?? undefined })
      .then((res) => {
        if (!alive) return;
        setHistory(res.data);
        // 처음 로드 시(선택 전) 백엔드가 골라준 연도를 탭 활성 표시에 반영한다.
        if (selectedYear === null && res.data.year) setSelectedYear(res.data.year);
      })
      .catch(() => {
        if (alive) setHistoryError(true);
      })
      .finally(() => {
        if (alive) setHistoryLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [selectedYear]);

  // 백엔드가 이미 검색 관심도 변화율(trend_pct) 내림차순으로 정렬해 주므로,
  // 앞쪽은 뜨는 업종, 뒤쪽은 지는 업종이다.
  const allItems = ranking?.ranking ?? [];
  const rising = useMemo(() => allItems.slice(0, KEYWORD_LIMIT), [allItems]);
  const sinking = useMemo(() => [...allItems].slice(-KEYWORD_LIMIT).reverse(), [allItems]);

  const popularItems = popular?.items ?? [];

  const currentCalendarYear = String(new Date().getFullYear());
  const historyYearLabel = history?.year
    ? history.year === currentCalendarYear
      ? "올해"
      : `${history.year}년`
    : "최근";

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>트렌드</h1>
          <p className={styles.subtitle}>네이버 검색 관심도로 읽는 서울 전체 상권의 오늘과 내일</p>
        </div>
      </div>

      {/* 키워드 */}
      <section className={styles.section}>
        <div className={styles.sectionTitle}>
          <span className={styles.accentBar} />
          <div>
            <h2 className={styles.sectionHeading}>업종 키워드</h2>
            <p className={styles.sectionSub}>
              많이 검색된 업종을 키워드로 살펴보고, 클릭하면 함께 움직이는 관련 업종을 확인해보세요
            </p>
          </div>
        </div>

        <div className={styles.card}>
          {popularLoading ? (
            <div className={styles.skeleton} />
          ) : popularError ? (
            <div className={styles.empty}>키워드 데이터를 불러오지 못했어요.</div>
          ) : (
            <KeywordCloud items={popularItems} />
          )}
        </div>
      </section>

      {/* 인기 업종 월별 추이 */}
      <section className={styles.section}>
        <div className={styles.sectionTitle}>
          <span className={styles.accentBar} />
          <div className={styles.sectionTitleText}>
            <h2 className={styles.sectionHeading}>{historyYearLabel} 인기 업종 순위 변화</h2>
            <p className={styles.sectionSub}>
              선택한 연도 안에서 인기 업종들이 달마다 서로 대비 어떻게 순위가 바뀌었는지 보여줘요
            </p>
          </div>
          {history != null && history.available_years.length > 1 && (
            <div className={styles.yearTabs}>
              {history.available_years.map((y) => (
                <button
                  key={y}
                  type="button"
                  className={y === selectedYear ? styles.yearTabActive : styles.yearTab}
                  onClick={() => setSelectedYear(y)}
                >
                  {y}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={styles.card}>
          {historyLoading ? (
            <div className={styles.skeleton} />
          ) : historyError ? (
            <div className={styles.empty}>추이 데이터를 불러오지 못했어요.</div>
          ) : (
            <CategoryRaceChart periods={history?.periods ?? []} series={history?.series ?? []} />
          )}
        </div>
      </section>

      {/* 떠오르는 업종 / 침몰하는 업종 */}
      <div className={styles.rankingGrid}>
        <section className={styles.section}>
          <div className={styles.sectionTitle}>
            <span className={styles.accentBar} />
            <div>
              <h2 className={styles.sectionHeading}>떠오르는 업종</h2>
            </div>
          </div>

          <div className={styles.card}>
            {loading ? (
              <div className={styles.skeleton} />
            ) : error ? (
              <div className={styles.empty}>업종 데이터를 불러오지 못했어요.</div>
            ) : rising.length === 0 ? (
              <div className={styles.empty}>업종 순위 데이터가 아직 집계되지 않았습니다.</div>
            ) : (
              <ul className={styles.risingList}>
                {rising.map((item) => (
                  <li key={`rising-${item.rank}-${item.category_name}`} className={styles.risingRow}>
                    <span className={styles.risingName}>{item.category_name}</span>
                    <span className={styles.metricsGroup}>
                      <span className={styles.risingMetric}>
                        <span className={styles.risingMetricLabel}>변화율</span>
                        <span className={styles.risingMetricValue}>
                          <TrendValue value={item.trend_pct} format={fmtPctMagnitude} />
                        </span>
                      </span>
                      <span className={styles.risingMetric}>
                        <span className={styles.risingMetricLabel}>검색지수</span>
                        <span className={styles.risingMetricValue}>{fmtIndex(item.latest_ratio)}</span>
                      </span>
                      <span className={styles.risingMetric}>
                        <span className={styles.risingMetricLabel}>전분기 대비</span>
                        <span className={styles.risingMetricValue}>
                          <TrendValue value={item.qoq_business_change} format={fmtCountMagnitude} />
                        </span>
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionTitle}>
            <span className={styles.accentBar} />
            <div>
              <h2 className={styles.sectionHeading}>침몰중인 업종</h2>
            </div>
          </div>

          <div className={styles.card}>
            {loading ? (
              <div className={styles.skeleton} />
            ) : error ? (
              <div className={styles.empty}>업종 데이터를 불러오지 못했어요.</div>
            ) : sinking.length === 0 ? (
              <div className={styles.empty}>업종 순위 데이터가 아직 집계되지 않았습니다.</div>
            ) : (
              <ul className={styles.risingList}>
                {sinking.map((item) => (
                  <li key={`sinking-${item.rank}-${item.category_name}`} className={styles.risingRow}>
                    <span className={styles.risingName}>{item.category_name}</span>
                    <span className={styles.metricsGroup}>
                      <span className={styles.risingMetric}>
                        <span className={styles.risingMetricLabel}>변화율</span>
                        <span className={styles.risingMetricValue}>
                          <TrendValue value={item.trend_pct} format={fmtPctMagnitude} />
                        </span>
                      </span>
                      <span className={styles.risingMetric}>
                        <span className={styles.risingMetricLabel}>검색지수</span>
                        <span className={styles.risingMetricValue}>{fmtIndex(item.latest_ratio)}</span>
                      </span>
                      <span className={styles.risingMetric}>
                        <span className={styles.risingMetricLabel}>전분기 대비</span>
                        <span className={styles.risingMetricValue}>
                          <TrendValue value={item.qoq_business_change} format={fmtCountMagnitude} />
                        </span>
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
