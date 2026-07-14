import { useEffect, useMemo, useState } from "react";
import { commercialApi } from "../services/commercialApi";
import type { CategorySearchTrendRankingResponse, PopularCategoriesResponse } from "../types";
import KeywordCloud from "../components/trends/KeywordCloud";
import TrendValue from "../components/trends/TrendValue";
import { fmtCountMagnitude, fmtIndex, fmtPctMagnitude } from "../components/trends/trendsFormat";
import styles from "./TrendsPage.module.css";

const KEYWORD_LIMIT = 6;
/** 백엔드가 반환 가능한 업종 전체 수만큼 요청해 rising/sinking을 클라이언트에서 양끝으로 슬라이스한다. */
const RANKING_FETCH_LIMIT = 100;
const POPULAR_LIMIT = 9;

export default function TrendsPage() {
  const [ranking, setRanking] = useState<CategorySearchTrendRankingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [popular, setPopular] = useState<PopularCategoriesResponse | null>(null);
  const [popularLoading, setPopularLoading] = useState(true);
  const [popularError, setPopularError] = useState(false);

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

  // 백엔드가 이미 검색 관심도 변화율(trend_pct) 내림차순으로 정렬해 주므로,
  // 앞쪽은 뜨는 업종, 뒤쪽은 지는 업종이다.
  const allItems = ranking?.ranking ?? [];
  const rising = useMemo(() => allItems.slice(0, KEYWORD_LIMIT), [allItems]);
  const sinking = useMemo(() => [...allItems].slice(-KEYWORD_LIMIT).reverse(), [allItems]);

  const popularItems = popular?.items ?? [];

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
