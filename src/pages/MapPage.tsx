import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../lib/apiClient";
import { commercialApi } from "../services/commercialApi";
import SangkwonPanel from "../components/map/SangkwonPanel";
import FilterBar from "../components/map/FilterBar";
import LeafletMap, { type MapMode } from "../components/map/LeafletMap";
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

const DEFAULT_DISTRICT_ID = 1;

export default function MapPage() {
  const navigate = useNavigate();
  const openProfile = useCallback((id: number) => navigate(`/dashboard/${id}`), [navigate]);

  const [selectedId, setSelectedId] = useState<number>(DEFAULT_DISTRICT_ID);
  const [summary, setSummary] = useState<DistrictSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<DistrictSearchResult[]>([]);
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

  // 검색 결과 클릭 → 실제 상권 선택(selectedId 변경) + 검색 초기화.
  const handlePickSearch = (id: number) => {
    setSelectedId(id);
    setQuery("");
    setOptions([]);
  };

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
      {/* 상단 검색 바 + 자동완성 결과 (앱 네비 사이드바는 AppLayout이 담당) */}
      <div className={styles.searchBar} style={{ position: "relative" }}>
        <span className={styles.searchIcon} aria-hidden>
          ⌕
        </span>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="지역·상권·업종 검색…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
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
                  onClick={() => handlePickSearch(o.id)}
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

      <FilterBar
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        guFilter={guFilter}
        onGuFilterChange={setGuFilter}
        popFilter={popFilter}
        onPopFilterChange={setPopFilter}
      />

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
          <LeafletMap
            points={filteredGeo}
            geojson={filteredGeojson}
            mode={mode}
            selectedId={selectedId}
            activeName={summary?.detail?.district_name ?? null}
            activeType={summary?.detail?.type_name ?? null}
            activeScore={activeScore}
            onSelect={setSelectedId}
            onOpenProfile={openProfile}
          />
        </div>
      </div>
    </div>
  );
}
