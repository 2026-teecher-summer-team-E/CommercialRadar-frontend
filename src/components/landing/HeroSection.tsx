import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../../lib/apiClient";
import type { DistrictSearchResult } from "../map/mapData";
import styles from "../../pages/LandingPage.module.css";
import { POPULAR_SEARCHES } from "./data";
import { SearchIcon } from "./icons";

/** 히어로: 지도 배경 + 헤드라인 + 검색바 + 인기 검색어. */
export default function HeroSection() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  // 검색어로 상권을 찾아 그 상권의 지도 화면으로 이동. 결과 없으면 기본 지도로만 이동.
  const goToDistrict = async (keyword: string) => {
    const trimmed = keyword.trim();
    if (!trimmed) {
      navigate("/");
      return;
    }
    try {
      const res = await apiClient.get<DistrictSearchResult[]>("/api/commercial-districts/search", {
        params: { q: trimmed },
      });
      const first = res.data[0];
      navigate(first ? `/?district=${first.id}` : "/");
    } catch {
      navigate("/");
    }
  };

  return (
    <section className={styles.hero}>
      <div className={styles.heroGrid} aria-hidden="true" />
      <div className={styles.heroInner}>
        <h1 className={styles.heroTitle}>
          실패 없는 창업의 시작,
          <br />
          <span className={styles.heroTitleAccent}>데이터로 보는 진짜 상권</span>
        </h1>
        <p className={styles.heroSub}>
          원하는 지역만 검색하세요. 유동인구부터 생존율, 매출 예측까지 바로 확인합니다.
        </p>

        <div className={styles.searchBar}>
          <input
            className={styles.searchInput}
            type="text"
            placeholder="예: 성수동, 홍대, 연남동"
            aria-label="상권 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") goToDistrict(query);
            }}
          />
          <button
            type="button"
            className={`${styles.btnPrimary} ${styles.searchBtn}`}
            onClick={() => goToDistrict(query)}
          >
            <SearchIcon size={15} />
            상권 분석하기
          </button>
        </div>

        <div className={styles.popular}>
          <span className={styles.popularLabel}>인기 검색:</span>
          {POPULAR_SEARCHES.map((term) => (
            <button
              key={term}
              type="button"
              className={styles.popularChip}
              onClick={() => goToDistrict(term)}
            >
              {term}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
