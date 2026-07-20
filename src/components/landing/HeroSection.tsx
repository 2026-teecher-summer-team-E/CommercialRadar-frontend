import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../../lib/apiClient";
import { buildSignInPath, clerkEnabled, useAuth } from "../../lib/auth";
import type { DistrictSearchResult } from "../map/mapData";
import styles from "../../pages/LandingPage.module.css";
import { POPULAR_SEARCHES } from "./data";
import { buildSimulatorPathFromQuery } from "./heroSearch";
import { SearchIcon } from "./icons";

/** 히어로: 지도 배경 + 헤드라인 + 검색바 + 인기 검색어. */
export default function HeroSection() {
  const navigate = useNavigate();
  const { isLoaded, isSignedIn } = useAuth();
  const [query, setQuery] = useState("");

  // 검색어에 창업 예산(만원/억)이 담겨 있으면 창업 시뮬레이터로, 아니면 상권검색으로 분기.
  // 예: "임대료 1000만원짜리 카페를 차리고싶어" → /simulator?budget=10000000&area=66(20평).
  const handleSearch = (keyword: string) => {
    const simulatorPath = buildSimulatorPathFromQuery(keyword);
    if (simulatorPath) {
      if (clerkEnabled && isLoaded && !isSignedIn) {
        navigate(buildSignInPath(simulatorPath));
        return;
      }
      navigate(simulatorPath);
      return;
    }
    void goToDistrict(keyword);
  };

  // 검색어로 상권을 찾아 그 상권의 지도 화면으로 이동. 결과 없으면 기본 지도로만 이동.
  const goToDistrict = async (keyword: string) => {
    if (clerkEnabled && isLoaded && !isSignedIn) {
      navigate(buildSignInPath("/"));
      return;
    }

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
          데이터로 검증하는
          <br />
          <span className={styles.heroTitleAccent}>상권과 창업의 가능성</span>
        </h1>
        <p className={styles.heroSub}>
          지역을 검색하시면 해당 상권의 유동인구, 생존율, 예상 매출을
          <br />
          한눈에 분석해 드립니다.
        </p>

        <div className={styles.searchBar}>
          <input
            className={styles.searchInput}
            type="text"
            placeholder="예: 성수동 · 임대료 1000만원 카페"
            aria-label="상권 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch(query);
            }}
          />
          <button
            type="button"
            className={`${styles.btnPrimary} ${styles.searchBtn}`}
            onClick={() => handleSearch(query)}
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
