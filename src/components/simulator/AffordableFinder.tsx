import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { commercialApi } from "../../services/commercialApi";
import { queryKeys, useAffordableDistricts, useDistrictSearch } from "../../hooks/queries";
import { toScore } from "../map/mapData";
import type { MapPin } from "../map/LeafletMap";
import type {
  AffordableDistrict,
  CommercialDistrictSearchResult,
  DistrictGeo,
} from "../../types";
import PageLoader from "../common/PageLoader";
import { fmtWonShort, scoreColor, sqmToPyeong } from "./simulatorFormat";
import styles from "./AffordableFinder.module.css";

const LeafletMap = lazy(() => import("../map/LeafletMap"));

interface Props {
  /** 리스트에서 상권을 고르면 시뮬레이션으로 넘길 콜백. */
  onPick: (d: { id: number; name: string }) => void;
  /** 랜딩 검색 등에서 넘어온 초기 월 임대료 예산(원). 없으면 기본값. */
  initialBudget?: number;
  /** 랜딩 검색 등에서 넘어온 초기 점포 면적(㎡). 없으면 기본값. */
  initialArea?: number;
}

const DEFAULT_BUDGET = 3_000_000;
const DEFAULT_AREA = 33;
const BUDGET_PRESETS = [2_000_000, 3_000_000, 5_000_000];
const PAGE_SIZE = 10;
const EMPTY_GEO: DistrictGeo[] = [];
type SortKey = "rent" | "score";

// 다른 페이지에 다녀와도 검색 조건이 남도록 sessionStorage 에 저장한다(탭 세션 동안 유지).
const PERSIST_KEY = "simulator-affordable-search";
interface PersistedSearch {
  budget: number;
  area: number;
  region: string;
  sort: SortKey;
}

function loadPersistedSearch(): PersistedSearch | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PERSIST_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<PersistedSearch>;
    if (typeof p.budget !== "number" || p.budget <= 0) return null;
    if (typeof p.area !== "number" || p.area <= 0) return null;
    return {
      budget: p.budget,
      area: p.area,
      region: typeof p.region === "string" ? p.region : "",
      sort: p.sort === "score" ? "score" : "rent",
    };
  } catch {
    return null;
  }
}

function savePersistedSearch(value: PersistedSearch): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PERSIST_KEY, JSON.stringify(value));
  } catch {
    // 저장 실패(용량/프라이빗 모드 등)는 무시 — 영속화는 부가 기능일 뿐이다.
  }
}

export default function AffordableFinder({ onPick, initialBudget, initialArea }: Props) {
  // 초기값 우선순위: URL 파라미터(랜딩의 새 검색) > 저장값(재방문) > 기본값.
  // URL 파라미터가 있으면 "새 검색"이므로 저장된 지역/정렬은 무시하고 초기화한다.
  const [initial] = useState(() => {
    const hasUrlPrefill = initialBudget != null || initialArea != null;
    const persisted = hasUrlPrefill ? null : loadPersistedSearch();
    return {
      budget: initialBudget ?? persisted?.budget ?? DEFAULT_BUDGET,
      area: initialArea ?? persisted?.area ?? DEFAULT_AREA,
      region: persisted?.region ?? "",
      // 기본 정렬은 점수 높은 순(저장된 선택이 있으면 그것을 우선).
      sort: (persisted?.sort ?? "score") as SortKey,
    };
  });

  // 숫자를 입력하는 동안 과도한 요청이 생기지 않도록 잠깐 기다린 뒤 자동 반영한다.
  const [budgetInput, setBudgetInput] = useState(String(initial.budget));
  const [areaInput, setAreaInput] = useState(String(initial.area));
  const [regionQuery, setRegionQuery] = useState(initial.region);
  const [debouncedRegionQuery, setDebouncedRegionQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState(initial.region);
  const [applied, setApplied] = useState<{ budget: number; area: number } | null>({
    budget: initial.budget,
    area: initial.area,
  });
  const [sort, setSort] = useState<SortKey>(initial.sort);
  const [page, setPage] = useState(0);
  const [mapSelectedId, setMapSelectedId] = useState(0);

  // 검색 조건이 바뀔 때마다 저장 → /dashboard 등 다녀와도 복원된다. applied 가 null(입력 무효)이면 저장하지 않는다.
  useEffect(() => {
    if (!applied) return;
    savePersistedSearch({ budget: applied.budget, area: applied.area, region: selectedRegion, sort });
  }, [applied, selectedRegion, sort]);

  const regionKeyword = regionQuery.trim();
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedRegionQuery(regionKeyword), 250);
    return () => window.clearTimeout(timer);
  }, [regionKeyword]);

  const regionSearch = useDistrictSearch(debouncedRegionQuery, searchFocused);
  const regionResults: CommercialDistrictSearchResult[] =
    (regionKeyword && debouncedRegionQuery ? regionSearch.data : undefined) ?? [];
  const regionSearchLoading =
    !!regionKeyword && (regionKeyword !== debouncedRegionQuery || regionSearch.isFetching);

  const selectRegion = () => {
    if (!regionKeyword) return;
    setSelectedRegion(regionKeyword);
    setPage(0);
    setSearchFocused(false);
  };

  useEffect(() => {
    const budget = Math.round(Number(budgetInput.replace(/[^0-9]/g, "")));
    const area = Number(areaInput);
    if (!budget || budget <= 0 || !area || area <= 0) {
      setApplied(null);
      return;
    }

    const timer = window.setTimeout(() => {
      setApplied({ budget, area });
      setPage(0);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [budgetInput, areaInput]);

  const query = useAffordableDistricts(
    {
      monthly_budget: applied?.budget ?? 0,
      area_sqm: applied?.area ?? 33,
      floor_type: "전체",
      region: selectedRegion || undefined,
      limit: 2_000,
    },
    applied != null,
  );

  const districts = useMemo(() => {
    const list = query.data?.districts ?? [];
    if (sort === "score") {
      return [...list].sort((a, b) => (b.district_score ?? -1) - (a.district_score ?? -1));
    }
    return list; // 서버가 이미 임대료 오름차순
  }, [query.data, sort]);

  const totalPages = Math.max(1, Math.ceil(districts.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = useMemo(
    () => districts.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE),
    [districts, safePage],
  );

  const geoQuery = useQuery({
    queryKey: queryKeys.geo,
    queryFn: async () => (await commercialApi.geo()).data,
  });
  const geo = geoQuery.data ?? EMPTY_GEO;
  const selectedPoint = useMemo(
    () => geo.find((point) => point.id === mapSelectedId) ?? null,
    [geo, mapSelectedId],
  );

  // 검색 결과(현재 페이지)를 지도에 핀으로 표시한다. 결과에는 좌표가 없어 geo(중심좌표)와 id로 조인한다.
  const geoById = useMemo(() => {
    const m = new Map<number, DistrictGeo>();
    geo.forEach((g) => m.set(g.id, g));
    return m;
  }, [geo]);
  const resultPins = useMemo<MapPin[]>(() => {
    const pins: MapPin[] = [];
    pageItems.forEach((d, i) => {
      const g = geoById.get(d.district_id);
      if (!g) return;
      pins.push({
        id: d.district_id,
        lat: g.lat,
        lng: g.lng,
        label: String(safePage * PAGE_SIZE + i + 1),
        name: d.district_name,
      });
    });
    return pins;
  }, [pageItems, geoById, safePage]);

  return (
    <div className={styles.wrap}>
      <div className={styles.form}>
        <div className={styles.regionSearch}>
          <label className={styles.label} htmlFor="simulator-region-search">
            지역 검색
          </label>
          <div className={styles.regionSearchInputWrap}>
            <span className={styles.searchIcon} aria-hidden>
              ⌕
            </span>
            <input
              id="simulator-region-search"
              className={styles.regionSearchInput}
              type="search"
              value={regionQuery}
              onChange={(e) => {
                const value = e.target.value;
                setRegionQuery(value);
                if (!value.trim()) {
                  setSelectedRegion("");
                  setPage(0);
                }
              }}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => window.setTimeout(() => setSearchFocused(false), 150)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && regionKeyword) {
                  e.preventDefault();
                  selectRegion();
                }
              }}
              placeholder="상권명, 자치구, 행정동으로 검색"
              aria-label="지역 및 상권 검색"
            />
          </div>

          {searchFocused && regionKeyword && (
            <div className={styles.regionSearchResults} role="listbox" aria-label="지역 검색 결과">
              {regionSearchLoading ? (
                <p className={styles.searchMessage}>상권을 찾고 있습니다.</p>
              ) : regionSearch.isError ? (
                <p className={styles.searchMessage}>Enter를 눌러 해당 지역 순위를 확인하세요.</p>
              ) : regionResults.length === 0 ? (
                <p className={styles.searchMessage}>
                  Enter를 눌러 ‘{regionKeyword}’ 지역 순위를 확인하세요.
                </p>
              ) : (
                regionResults.map((result) => {
                  const location = [result.gu_name, result.dong_name, result.type_name]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <button
                      type="button"
                      className={styles.regionSearchResult}
                      key={result.id}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={selectRegion}
                      role="option"
                    >
                      <span>
                        <strong>{result.district_name}</strong>
                        {location && <small>{location}</small>}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        <div className={styles.controls}>
          <div className={styles.field}>
            <span className={styles.label}>최대 월 임대료</span>
            <div className={styles.budgetInputWrap}>
              <input
                className={styles.input}
                inputMode="numeric"
                value={budgetInput ? Number(budgetInput).toLocaleString() : ""}
                onChange={(e) => setBudgetInput(e.target.value.replace(/[^0-9]/g, ""))}
                aria-label="최대 월 임대료(원)"
              />
              <span className={styles.unit}>원</span>
            </div>
            <div className={styles.presets}>
              {BUDGET_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={styles.preset}
                  onClick={() => setBudgetInput(String(p))}
                >
                  {p / 1e4}만
                </button>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <span className={styles.label}>최대 점포 면적</span>
            <div className={styles.budgetInputWrap}>
              <input
                className={`${styles.input} ${styles.inputSm}`}
                inputMode="decimal"
                value={areaInput}
                onChange={(e) => setAreaInput(e.target.value)}
                aria-label="최대 점포 면적(㎡)"
              />
              <span className={styles.unit}>㎡</span>
            </div>
            <span className={styles.hint}>약 {sqmToPyeong(Number(areaInput) || 0)}평</span>
          </div>

        </div>
      </div>

      {/* 결과 */}
      {query.isLoading ? (
        <PageLoader fullScreen={false} />
      ) : query.isError ? (
        <div className={styles.empty}>목록을 불러오지 못했습니다.</div>
      ) : !query.data ? (
        <div className={styles.empty}>월 임대료 예산과 점포 면적을 입력해 주세요.</div>
      ) : districts.length === 0 ? (
        <div className={styles.empty}>
          {selectedRegion
            ? `‘${selectedRegion}’ 지역에는 이 예산으로 창업 가능한 상권이 없어요.`
            : "이 예산으로 창업 가능한 상권이 없어요. 예산을 올려보세요."}
        </div>
      ) : (
        <div className={styles.resultsGrid}>
          <div className={styles.listCol}>
            <div className={styles.resultHead}>
            <span className={styles.resultCount}>
              {selectedRegion && <>{selectedRegion} 지역 · </>}
              검색결과 <strong>{query.data.count.toLocaleString()}곳</strong>
              {query.data.count > districts.length && ` · 상위 ${districts.length}곳`}
            </span>
            <div className={styles.sortToggle}>
              <button
                type="button"
                className={sort === "score" ? styles.sortActive : styles.sortBtn}
                onClick={() => {
                  setSort("score");
                  setPage(0);
                }}
              >
                점수 높은 순
              </button>
              <button
                type="button"
                className={sort === "rent" ? styles.sortActive : styles.sortBtn}
                onClick={() => {
                  setSort("rent");
                  setPage(0);
                }}
              >
                저렴한 순
              </button>
            </div>
          </div>
          <ul className={styles.list}>
            {pageItems.map((d: AffordableDistrict, i) => (
              <li key={d.district_id}>
                <button
                  type="button"
                  className={styles.row}
                  onClick={() => setMapSelectedId(d.district_id)}
                >
                  <span className={styles.rank}>{safePage * PAGE_SIZE + i + 1}</span>
                  <span className={styles.rowMain}>
                    <span className={styles.name}>{d.district_name}</span>
                    <span className={styles.meta}>{[d.gu_name, d.type_name].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className={styles.rowRight}>
                    <span className={styles.rent}>{fmtWonShort(d.est_monthly_rent)}/월</span>
                    <span className={styles.rentSub}>{d.rent_per_sqm.toLocaleString()}천원/㎡</span>
                  </span>
                  {d.district_score != null && (
                    <span className={styles.scoreBadge} style={{ background: scoreColor(d.district_score) }}>
                      {Math.round(d.district_score)}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {totalPages > 1 && (
            <div className={styles.pager}>
              <button
                type="button"
                className={`${styles.pagerBtn} ${styles.pagerJump}`}
                disabled={safePage === 0}
                onClick={() => setPage(Math.max(0, safePage - 10))}
                aria-label="10페이지 이전"
              >
                «
              </button>
              <button
                type="button"
                className={styles.pagerBtn}
                disabled={safePage === 0}
                onClick={() => setPage(safePage - 1)}
              >
                이전
              </button>
              <span className={styles.pagerInfo}>
                {safePage + 1} / {totalPages}
              </span>
              <button
                type="button"
                className={styles.pagerBtn}
                disabled={safePage === totalPages - 1}
                onClick={() => setPage(safePage + 1)}
              >
                다음
              </button>
              <button
                type="button"
                className={`${styles.pagerBtn} ${styles.pagerJump}`}
                disabled={safePage === totalPages - 1}
                onClick={() => setPage(Math.min(totalPages - 1, safePage + 10))}
                aria-label="10페이지 다음"
              >
                »
              </button>
            </div>
          )}
          <p className={styles.footnote}>
            추정 월 임대료 = ㎡당 임대료 × 최대 점포 면적. 입력한 최대 월 임대료 이하의 모든 상권을 표시합니다. 임대료 데이터가 있는 상권(~14%)만 대상입니다. 상권을 누르면 지도에서 위치를 확인할 수 있습니다.
          </p>
          </div>

          <div className={styles.mapCol}>
            <Suspense fallback={<PageLoader fullScreen={false} />}>
              <LeafletMap
                points={geo}
                geojson={null}
                pins={resultPins}
                selectedId={mapSelectedId}
                guFilter="전체"
                activeName={selectedPoint?.district_name ?? null}
                activeType={selectedPoint?.type_name ?? null}
                activeScore={toScore(selectedPoint?.district_score)}
                flyToSelectionOnMount={false}
                onSelect={setMapSelectedId}
                onOpenProfile={(id) => {
                  const point = geo.find((item) => item.id === id);
                  onPick({ id, name: point?.district_name ?? "" });
                }}
              />
            </Suspense>
          </div>
        </div>
      )}
    </div>
  );
}
