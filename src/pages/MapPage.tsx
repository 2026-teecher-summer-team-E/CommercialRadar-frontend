import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiClient } from "../lib/apiClient";
import { commercialApi } from "../services/commercialApi";
import { useRecentSearches, type RecentSearchItem } from "../hooks/useRecentSearches";
import SangkwonPanel from "../components/map/SangkwonPanel";
import FilterBar from "../components/map/FilterBar";
import type { MapMode } from "../components/map/LeafletMap";
import PageLoader from "../components/common/PageLoader";

// leaflet은 무거우므로 지도 화면에 실제로 진입할 때만 로드.
const LeafletMap = lazy(() => import("../components/map/LeafletMap"));
import {
  populationBucket,
  toScore,
  type DistrictDetail,
  type DistrictSearchResult,
  type DistrictSummary,
  type PopulationBucket,
} from "../components/map/mapData";
import type { CategoryStat, DistrictGeo } from "../types";
import styles from "./MapPage.module.css";

const DEFAULT_DISTRICT_ID = 1315;

export default function MapPage() {
  const navigate = useNavigate();
  const openProfile = useCallback((id: number) => navigate(`/dashboard/${id}`), [navigate]);

  // 다른 페이지(랭킹 등)에서 ?district=<id> 로 진입하면 그 상권을 선택된 상태로 연다.
  const [searchParams, setSearchParams] = useSearchParams();
  const districtParam = Number(searchParams.get("district"));
  const initialDistrictId =
    Number.isFinite(districtParam) && districtParam > 0 ? districtParam : DEFAULT_DISTRICT_ID;

  const [selectedId, setSelectedId] = useState<number>(initialDistrictId);
  // 마운트 시점 값을 기억해 두고, 실제로 그 값에서 벗어날 때만 URL에 반영한다.
  // (boolean 플래그로 "최초 1회"를 가리면 StrictMode의 effect 이중 실행에서 깨지므로 값 비교로 판단)
  const lastSyncedIdRef = useRef(initialDistrictId);

  // 사용자가 실제로 상권을 바꿀 때만 URL에 반영(진입 시 기본값으로 URL을 건드리지 않음). 히스토리 스팸 방지를 위해 replace 사용.
  useEffect(() => {
    if (selectedId === lastSyncedIdRef.current) return;
    lastSyncedIdRef.current = selectedId;
    setSearchParams(
      (prev) => {
        prev.set("district", String(selectedId));
        return prev;
      },
      { replace: true },
    );
  }, [selectedId, setSearchParams]);
  const [summary, setSummary] = useState<DistrictSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<DistrictSearchResult[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchBarRef = useRef<HTMLDivElement | null>(null);
  const { items: recentSearches, addSearch, removeSearch } = useRecentSearches();
  const [geo, setGeo] = useState<DistrictGeo[]>([]);
  const [geojson, setGeojson] = useState<GeoJSON.FeatureCollection | null>(null);
  const [mode, setMode] = useState<MapMode>("regions");

  // 지도 필터(마커/구역 실필터): 상권유형/자치구/유동인구.
  const [typeFilter, setTypeFilter] = useState<string>("전체");
  const [guFilter, setGuFilter] = useState<string>("전체");
  const [popFilter, setPopFilter] = useState<PopulationBucket>("전체");

  // 업종 필터(선택 상권 지표만 재조회, 마커/지도는 그대로): 상권 상세 로드 시 그 상권에 실재하는 업종 목록도 함께 받아둔다.
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [availableCategories, setAvailableCategories] = useState<CategoryStat[]>([]);

  // 전 상권 좌표(핀) + 경계 폴리곤(구역) 1회 로드.
  useEffect(() => {
    let alive = true;
    commercialApi
      .geo()
      .then((r) => alive && setGeo(r.data))
      .catch(() => alive && setGeo([]));
    commercialApi
      .geojson()
      .then((r) => alive && setGeojson(r.data))
      .catch(() => alive && setGeojson(null));
    return () => {
      alive = false;
    };
  }, []);

  // 선택 상권 상세(좌측 패널) 로드. 업종 필터는 상권이 바뀌면 이전 상권 기준 선택값이 무의미해지므로 초기화.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(false);
    setCategoryFilter(null);

    Promise.allSettled([
      commercialApi.getDistrict(selectedId) as Promise<{ data: DistrictDetail }>,
      commercialApi.radar(selectedId),
      commercialApi.heatmap(selectedId),
      commercialApi.timeSeries(selectedId),
      commercialApi.categoryStats(selectedId),
    ])
      .then(([detailR, radarR, heatmapR, tsR, catR]) => {
        if (!alive) return;
        if (detailR.status !== "fulfilled") {
          setError(true);
          setSummary(null);
          setAvailableCategories([]);
          return;
        }
        setSummary({
          detail: detailR.value.data,
          radar: radarR.status === "fulfilled" ? radarR.value.data : null,
          heatmap: heatmapR.status === "fulfilled" ? heatmapR.value.data : null,
          timeSeries: tsR.status === "fulfilled" ? tsR.value.data : null,
        });
        setAvailableCategories(catR.status === "fulfilled" ? catR.value.data.categories : []);
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
  }, [selectedId]);

  // 상권유형 + 자치구 + 유동인구 필터를 지도 마커/구역에 실제로 적용.
  const matchesFilters = useCallback(
    (typeName: string | null, guName: string | null, population: number | null) => {
      if (typeFilter !== "전체" && typeName !== typeFilter) return false;
      if (guFilter !== "전체" && guName !== guFilter) return false;
      if (popFilter !== "전체" && populationBucket(population) !== popFilter) return false;
      return true;
    },
    [typeFilter, guFilter, popFilter],
  );

  const filteredGeo = useMemo(
    () => geo.filter((p) => matchesFilters(p.type_name, p.gu_name, p.population)),
    [geo, matchesFilters],
  );

  const filteredGeojson = useMemo<GeoJSON.FeatureCollection | null>(() => {
    if (!geojson) return geojson;
    return {
      ...geojson,
      features: geojson.features.filter((f) =>
        matchesFilters(
          (f.properties?.type_name as string | null) ?? null,
          (f.properties?.gu_name as string | null) ?? null,
          (f.properties?.population as number | null) ?? null,
        ),
      ),
    };
  }, [geojson, matchesFilters]);

  // 검색: 입력 디바운스 후 위치 드롭다운 옵션 갱신.
  useEffect(() => {
    const keyword = query.trim();
    if (!keyword) {
      setOptions([]);
      return;
    }
    let alive = true;
    const t = setTimeout(() => {
      apiClient
        .get<DistrictSearchResult[]>("/api/commercial-districts/search", {
          params: { q: keyword },
        })
        .then((res) => {
          if (alive) setOptions(res.data);
        })
        .catch(() => {
          if (alive) setOptions([]);
        });
    }, 300);

    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [query]);

  // 검색 결과 클릭 → 실제 상권 선택(selectedId 변경) + 그 상권을 최근 검색어에 저장 + 검색 초기화.
  const handlePickSearch = (result: DistrictSearchResult) => {
    addSearch({
      id: result.id,
      district_name: result.district_name,
      gu_name: result.gu_name,
      dong_name: result.dong_name,
    });
    setSelectedId(result.id);
    setQuery("");
    setOptions([]);
    setSearchFocused(false);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && options.length > 0) handlePickSearch(options[0]);
  };

  // 최근 검색어 클릭 → 해당 상권으로 바로 이동(재검색은 최신순으로 다시 끌어올림).
  const handlePickRecent = (item: RecentSearchItem) => {
    addSearch(item);
    setSelectedId(item.id);
    setQuery("");
    setOptions([]);
    setSearchFocused(false);
  };

  // 검색 바 바깥 클릭 시 최근 검색어 드롭다운 닫기(FilterBar와 동일한 패턴).
  useEffect(() => {
    if (!searchFocused) return;
    const onDocClick = (e: MouseEvent) => {
      if (searchBarRef.current && !searchBarRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [searchFocused]);

  const activeScore = useMemo(
    () =>
      toScore(
        summary?.detail?.latest_stats?.district_score ??
          (summary?.radar
            ? summary.radar.axes.reduce((a, x) => a + x.value, 0) /
              (summary.radar.axes.length || 1)
            : null),
      ),
    [summary],
  );

  return (
    <div className={styles.page}>
      {/* 상단: 필터(자치구/상권유형/유동인구) + 검색 바를 한 줄로 통합 (앱 네비 사이드바는 AppLayout이 담당) */}
      <div className={styles.topRow}>
        <FilterBar
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          guFilter={guFilter}
          onGuFilterChange={setGuFilter}
          popFilter={popFilter}
          onPopFilterChange={setPopFilter}
        />

        <div className={styles.searchBar} style={{ position: "relative" }} ref={searchBarRef}>
        <span className={styles.searchIcon} aria-hidden>
          ⌕
        </span>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="지역·상권·업종 검색…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onKeyDown={handleSearchKeyDown}
        />
        {searchFocused && !query.trim() && recentSearches.length > 0 && (
          <ul
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              right: 0,
              zIndex: 1200,
              listStyle: "none",
              margin: 0,
              padding: 6,
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 12,
              boxShadow: "var(--shadow-pop)",
              maxHeight: 320,
              overflowY: "auto",
            }}
          >
            {recentSearches.map((item) => (
              <li key={item.id} style={{ display: "flex", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => handlePickRecent(item)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    textAlign: "left",
                    padding: "9px 12px",
                    border: "none",
                    background: "transparent",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontFamily: "var(--font-sans)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text)" }}>
                    {item.district_name}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--color-muted)" }}>
                    {[item.gu_name, item.dong_name].filter(Boolean).join(" · ")}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`${item.district_name} 삭제`}
                  onClick={() => removeSearch(item.id)}
                  style={{
                    flex: "none",
                    width: 24,
                    height: 24,
                    marginRight: 4,
                    border: "none",
                    background: "transparent",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 13,
                    color: "var(--color-faint)",
                  }}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        {query.trim() && options.length > 0 && (
          <ul
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              right: 0,
              zIndex: 1200,
              listStyle: "none",
              margin: 0,
              padding: 6,
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 12,
              boxShadow: "var(--shadow-pop)",
              maxHeight: 320,
              overflowY: "auto",
            }}
          >
            {options.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => handlePickSearch(o)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "9px 12px",
                    border: "none",
                    background: "transparent",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontFamily: "var(--font-sans)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text)" }}>
                    {o.district_name}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--color-muted)" }}>
                    {[o.gu_name, o.dong_name].filter(Boolean).join(" · ")}
                    {o.type_name ? ` · ${o.type_name}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        </div>
      </div>

      <div className={styles.body}>
        <SangkwonPanel
          summary={summary}
          loading={loading}
          error={error}
          onOpenProfile={openProfile}
          availableCategories={availableCategories}
          categoryFilter={categoryFilter}
          onCategoryFilterChange={setCategoryFilter}
        />
        <div style={{ flex: 1, position: "relative", display: "flex", minWidth: 0 }}>
          <div
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              zIndex: 1000,
              display: "flex",
              gap: 2,
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              padding: 3,
              boxShadow: "0 1px 2px rgba(15,23,42,.1)",
            }}
          >
            {(["regions", "pins"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                style={{
                  padding: "6px 14px",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: "var(--font-sans)",
                  cursor: "pointer",
                  background: mode === m ? "var(--color-primary-light)" : "transparent",
                  color: mode === m ? "var(--color-primary)" : "var(--color-muted)",
                }}
              >
                {m === "regions" ? "구역" : "핀"}
              </button>
            ))}
          </div>
          <Suspense fallback={<PageLoader fullScreen={false} />}>
            <LeafletMap
              points={filteredGeo}
              geojson={filteredGeojson}
              mode={mode}
              selectedId={selectedId}
              guFilter={guFilter}
              activeName={summary?.detail?.district_name ?? null}
              activeType={summary?.detail?.type_name ?? null}
              activeScore={activeScore}
              onSelect={setSelectedId}
              onOpenProfile={openProfile}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
