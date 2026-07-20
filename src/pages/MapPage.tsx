import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { commercialApi } from "../services/commercialApi";
import { queryKeys, useDistrictSearch } from "../hooks/queries";
import { useRecentSearches, type RecentSearchItem } from "../hooks/useRecentSearches";
import SangkwonPanel from "../components/map/SangkwonPanel";
import FilterBar from "../components/map/FilterBar";
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
const EMPTY_GEO: DistrictGeo[] = [];
const MAP_PAGE_STORAGE_KEY = "commercialRadar.mapPageState.v1";

interface PersistedMapPageState {
  selectedId: number | null;
  query: string;
  typeFilter: string;
  guFilter: string;
  popFilter: PopulationBucket;
  categoryFilter: string | null;
}

const DEFAULT_MAP_PAGE_STATE: PersistedMapPageState = {
  selectedId: DEFAULT_DISTRICT_ID,
  query: "",
  typeFilter: "전체",
  guFilter: "전체",
  popFilter: "전체",
  categoryFilter: null,
};

function readMapPageState(): PersistedMapPageState {
  if (typeof window === "undefined") return DEFAULT_MAP_PAGE_STATE;
  try {
    const raw = window.localStorage.getItem(MAP_PAGE_STORAGE_KEY);
    if (!raw) return DEFAULT_MAP_PAGE_STATE;
    const parsed = JSON.parse(raw) as Partial<PersistedMapPageState>;
    return {
      selectedId:
        parsed.selectedId === null
          ? null
          : typeof parsed.selectedId === "number" && Number.isFinite(parsed.selectedId) && parsed.selectedId > 0
            ? parsed.selectedId
            : DEFAULT_MAP_PAGE_STATE.selectedId,
      query: typeof parsed.query === "string" ? parsed.query : DEFAULT_MAP_PAGE_STATE.query,
      typeFilter: typeof parsed.typeFilter === "string" ? parsed.typeFilter : DEFAULT_MAP_PAGE_STATE.typeFilter,
      guFilter: typeof parsed.guFilter === "string" ? parsed.guFilter : DEFAULT_MAP_PAGE_STATE.guFilter,
      popFilter:
        parsed.popFilter === "전체" || parsed.popFilter === "적음" || parsed.popFilter === "보통" || parsed.popFilter === "많음"
          ? parsed.popFilter
          : DEFAULT_MAP_PAGE_STATE.popFilter,
      categoryFilter:
        typeof parsed.categoryFilter === "string" || parsed.categoryFilter === null
          ? parsed.categoryFilter
          : DEFAULT_MAP_PAGE_STATE.categoryFilter,
    };
  } catch {
    return DEFAULT_MAP_PAGE_STATE;
  }
}

/** 좌측 패널 상세 5개 API 병렬 호출. 상권 상세 실패만 에러, 나머지는 null 허용(allSettled). */
async function fetchMapSummary(
  id: number,
): Promise<{ summary: DistrictSummary; categories: CategoryStat[] }> {
  const [detailR, radarR, heatmapR, tsR, catR] = await Promise.allSettled([
    commercialApi.getDistrict(id) as Promise<{ data: DistrictDetail }>,
    commercialApi.radar(id),
    commercialApi.heatmap(id),
    commercialApi.timeSeries(id),
    commercialApi.categoryStats(id),
  ]);
  if (detailR.status !== "fulfilled") throw new Error(`상권 ${id} 조회 실패`);
  return {
    summary: {
      detail: detailR.value.data,
      radar: radarR.status === "fulfilled" ? radarR.value.data : null,
      heatmap: heatmapR.status === "fulfilled" ? heatmapR.value.data : null,
      timeSeries: tsR.status === "fulfilled" ? tsR.value.data : null,
    },
    categories: catR.status === "fulfilled" ? catR.value.data.categories : [],
  };
}

export default function MapPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const openProfile = useCallback((id: number) => navigate(`/dashboard/${id}`), [navigate]);
  const [initialState] = useState(readMapPageState);

  // 다른 페이지(랭킹 등)에서 ?district=<id> 로 진입하면 그 상권을 선택된 상태로 연다.
  const [searchParams, setSearchParams] = useSearchParams();
  const districtParam = Number(searchParams.get("district"));
  const initialDistrictId: number | null =
    Number.isFinite(districtParam) && districtParam > 0 ? districtParam : initialState.selectedId;

  const [selectedId, setSelectedId] = useState<number | null>(initialDistrictId);
  // 마운트 시점 값을 기억해 두고, 실제로 그 값에서 벗어날 때만 URL에 반영한다.
  // (boolean 플래그로 "최초 1회"를 가리면 StrictMode의 effect 이중 실행에서 깨지므로 값 비교로 판단)
  const lastSyncedIdRef = useRef<number | null>(initialDistrictId);

  // 랭킹 등 다른 페이지에서 "이 상권으로 포커스 이동" 의도를 갖고 들어왔는지(navigate state로 전달).
  // 새로고침 시에는 이 의도가 재현되면 안 되므로 마운트 시점 값만 한 번 읽어 기억해두고 즉시 state를 비운다.
  const [focusOnMount] = useState<boolean>(
    () => (location.state as { flyToDistrict?: boolean } | null)?.flyToDistrict === true,
  );
  useEffect(() => {
    if (!location.state) return;
    navigate(
      { pathname: location.pathname, search: location.search },
      { replace: true, state: null },
    );
    // 마운트 시 1회만 소비하면 되므로 의도적으로 빈 deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 사용자가 실제로 상권을 바꿀 때만 URL에 반영(진입 시 기본값으로 URL을 건드리지 않음). 히스토리 스팸 방지를 위해 replace 사용.
  useEffect(() => {
    if (selectedId === lastSyncedIdRef.current) return;
    lastSyncedIdRef.current = selectedId;
    setSearchParams(
      (prev) => {
        if (selectedId == null) {
          prev.delete("district");
        } else {
          prev.set("district", String(selectedId));
        }
        return prev;
      },
      { replace: true },
    );
  }, [selectedId, setSearchParams]);
  const [query, setQuery] = useState(initialState.query);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const searchBarRef = useRef<HTMLDivElement | null>(null);
  const { items: recentSearches, addSearch, removeSearch } = useRecentSearches();

  // 지도 필터(구역 실필터): 상권유형/자치구/유동인구.
  const [typeFilter, setTypeFilter] = useState<string>(initialState.typeFilter);
  const [guFilter, setGuFilter] = useState<string>(initialState.guFilter);
  const [popFilter, setPopFilter] = useState<PopulationBucket>(initialState.popFilter);

  // 업종 필터(선택 상권 지표만 재조회, 마커/지도는 그대로).
  const [categoryFilter, setCategoryFilter] = useState<string | null>(initialState.categoryFilter);
  const categoryResetReadyRef = useRef(false);

  // 전 상권 좌표(자치구 필터 카메라 이동용) + 경계 폴리곤(구역 표시). 전역 캐시라 페이지 재진입 시 재요청 없음.
  const geoQuery = useQuery({
    queryKey: queryKeys.geo,
    queryFn: async () => (await commercialApi.geo()).data,
  });
  const geojsonQuery = useQuery({
    queryKey: queryKeys.geojson,
    queryFn: async () => (await commercialApi.geojson()).data,
  });
  const geo: DistrictGeo[] = geoQuery.data ?? EMPTY_GEO;
  const geojson = geojsonQuery.data ?? null;

  // 선택 상권 상세(좌측 패널). 상권 상세 로드 시 실재 업종 목록도 함께 받아둔다.
  // selectedId가 null(패널 닫힘)이면 요청하지 않는다 — queryKey는 disabled 상태에서도
  // number 타입을 유지해야 하므로 미사용 placeholder(-1)를 넣어둔다.
  const summaryQuery = useQuery({
    queryKey: queryKeys.mapSummary(selectedId ?? -1),
    queryFn: () => fetchMapSummary(selectedId as number),
    enabled: selectedId != null,
  });
  const summary = selectedId != null ? (summaryQuery.data?.summary ?? null) : null;
  const availableCategories: CategoryStat[] = selectedId != null ? (summaryQuery.data?.categories ?? []) : [];
  const loading = selectedId != null && summaryQuery.isPending;
  const error = selectedId != null && summaryQuery.isError;

  useEffect(() => {
    const state: PersistedMapPageState = {
      selectedId,
      query,
      typeFilter,
      guFilter,
      popFilter,
      categoryFilter,
    };
    window.localStorage.setItem(MAP_PAGE_STORAGE_KEY, JSON.stringify(state));
  }, [selectedId, query, typeFilter, guFilter, popFilter, categoryFilter]);

  // 상권이 바뀌면 이전 상권 기준 업종 필터 선택값이 무의미해지므로 초기화.
  useEffect(() => {
    if (!categoryResetReadyRef.current) {
      categoryResetReadyRef.current = true;
      return;
    }
    setCategoryFilter(null);
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

  // 검색: 입력 300ms 디바운스 후 요청. 같은 검색어는 캐시에서 즉시 응답.
  const keyword = query.trim();
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(keyword), 300);
    return () => clearTimeout(t);
  }, [keyword]);

  const searchQuery = useDistrictSearch(debouncedQuery);
  const options: DistrictSearchResult[] =
    (keyword && debouncedQuery ? searchQuery.data : undefined) ?? [];

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
    setSearchFocused(false);
  };

  // 정보 패널 닫기 → 선택 해제(지도는 서울 전역 뷰로 줌아웃).
  const handleClose = useCallback(() => setSelectedId(null), []);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && options.length > 0) handlePickSearch(options[0]);
  };

  // 최근 검색어 클릭 → 해당 상권으로 바로 이동(재검색은 최신순으로 다시 끌어올림).
  const handlePickRecent = (item: RecentSearchItem) => {
    addSearch(item);
    setSelectedId(item.id);
    setQuery("");
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
        {/* 상권이 선택됐을 때만 좌측 정보 패널을 표시한다. 닫기(×)를 누르면 selectedId가 null이 되어 패널이 사라진다. */}
        {selectedId != null && (
          <SangkwonPanel
            summary={summary}
            loading={loading}
            error={error}
            onOpenProfile={openProfile}
            availableCategories={availableCategories}
            categoryFilter={categoryFilter}
            onCategoryFilterChange={setCategoryFilter}
            onClose={handleClose}
          />
        )}
        <div style={{ position: "absolute", inset: 0, display: "flex", minWidth: 0 }}>
          <Suspense fallback={<PageLoader fullScreen={false} />}>
            <LeafletMap
              points={filteredGeo}
              geojson={filteredGeojson}
              selectedId={selectedId}
              guFilter={guFilter}
              activeName={summary?.detail?.district_name ?? null}
              activeType={summary?.detail?.type_name ?? null}
              activeScore={activeScore}
              flyToSelectionOnMount={focusOnMount}
              onSelect={setSelectedId}
              onOpenProfile={openProfile}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
