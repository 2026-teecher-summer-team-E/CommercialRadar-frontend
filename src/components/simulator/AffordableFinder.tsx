import { useEffect, useMemo, useState } from "react";
import { useAffordableDistricts, useDistrictSearch } from "../../hooks/queries";
import type { AffordableDistrict, CommercialDistrictSearchResult } from "../../types";
import FilterDropdown from "../common/FilterDropdown";
import InfoTip from "../common/InfoTip";
import { lazy, Suspense, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { commercialApi } from "../../services/commercialApi";
import { queryKeys, useAffordableDistricts } from "../../hooks/queries";
import { toScore } from "../map/mapData";
import type { AffordableDistrict, DistrictGeo } from "../../types";
import PageLoader from "../common/PageLoader";
import { fmtWonShort, scoreColor, sqmToPyeong } from "./simulatorFormat";
import styles from "./AffordableFinder.module.css";

// leaflet은 무거우므로 실제 렌더 시점에만 로드(지역 분석 페이지와 동일 패턴).
const LeafletMap = lazy(() => import("../map/LeafletMap"));

interface Props {
  /** 지도 팝업의 '상세 분석 보기'에서 상권을 고르면 상세 분석으로 넘길 콜백. */
  onPick: (d: { id: number; name: string }) => void;
}

const BUDGET_PRESETS = [2_000_000, 3_000_000, 5_000_000];
// 상가유형은 필터하지 않고 '전체'로 고정(상권별 최신·대표 임대료).
const FLOOR_TYPE = "전체";
const PAGE_SIZE = 10;
const EMPTY_GEO: DistrictGeo[] = [];
type SortKey = "rent" | "score";

export default function AffordableFinder({ onPick }: Props) {
  // 숫자를 입력하는 동안 과도한 요청이 생기지 않도록 잠깐 기다린 뒤 자동 반영한다.
  const [budgetInput, setBudgetInput] = useState("3000000");
  const [areaInput, setAreaInput] = useState("33");
  const [floorType, setFloorType] = useState("소규모");
  const [regionQuery, setRegionQuery] = useState("");
  const [debouncedRegionQuery, setDebouncedRegionQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState("");
  const [applied, setApplied] = useState<{ budget: number; area: number; floor: string } | null>({
    budget: 3_000_000,
    area: 33,
  });
  const [sort, setSort] = useState<SortKey>("score");
  const [page, setPage] = useState(0);

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
      setApplied({ budget, area, floor: floorType });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [budgetInput, areaInput, floorType]);

  const query = useAffordableDistricts(
    {
      monthly_budget: applied?.budget ?? 0,
      area_sqm: applied?.area ?? 33,
      floor_type: FLOOR_TYPE,
      limit: 500,
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

  // 결과가 바뀌어도 page가 범위를 벗어나지 않게 보정.
  const totalPages = Math.max(1, Math.ceil(districts.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  // 참조가 매 렌더 새로 생기면 지도 핑 effect가 불필요하게 재실행되므로 memo로 고정.
  const pageItems = useMemo(
    () => districts.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE),
    [districts, safePage],
  );

  // 우측 지도(지역 분석 페이지와 동일 데이터). 전역 캐시라 페이지 재진입 시 재요청 없음.
  const geoQuery = useQuery({
    queryKey: queryKeys.geo,
    queryFn: async () => (await commercialApi.geo()).data,
  });
  const geojsonQuery = useQuery({
    queryKey: queryKeys.geojson,
    queryFn: async () => (await commercialApi.geojson()).data,
  });
  const geo = geoQuery.data ?? EMPTY_GEO;
  const [mapSelectedId, setMapSelectedId] = useState(0);
  const selectedPoint = useMemo(
    () => geo.find((p) => p.id === mapSelectedId) ?? null,
    [geo, mapSelectedId],
  );

  // 현재 페이지 10곳을 순위 라벨 핑으로 표시(좌표는 geo에서 매칭, 없는 상권은 생략).
  const pins = useMemo(() => {
    const byId = new Map(geo.map((g) => [g.id, g]));
    return pageItems.flatMap((d, i) => {
      const g = byId.get(d.district_id);
      if (!g) return [];
      return [
        {
          id: d.district_id,
          lat: g.lat,
          lng: g.lng,
          label: String(safePage * PAGE_SIZE + i + 1),
          name: d.district_name,
        },
      ];
    });
  }, [pageItems, geo, safePage]);

  const apply = () => {
    const budget = Math.round(Number(budgetInput.replace(/[^0-9]/g, "")));
    const area = Number(areaInput);
    if (!budget || budget <= 0 || !area || area <= 0) return;
    setApplied({ budget, area });
    setPage(0);
  };

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
                if (!value.trim()) setSelectedRegion("");
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

          <div className={styles.field}>
            <span className={styles.label}>
              상가유형{" "}
              <InfoTip label="상가유형 설명" align="right">
                <strong>건물 규모·소유 형태 분류</strong> (한국부동산원 임대료 기준)
                <br />• <b>소규모</b>: 2층 이하·연면적 330㎡ 이하 소형 상가 (골목 1~2층)
                <br />• <b>중대형</b>: 3층 이상 또는 330㎡ 초과 (대로변 빌딩)
                <br />• <b>집합</b>: 구분소유 분양상가 (몰·주상복합)
                <br />유형에 따라 ㎡단가와 대상 상권이 달라집니다.
              </InfoTip>
            </span>
            <div className={styles.dropdownCell}>
              <FilterDropdown
                label="상가유형"
                value={floorType}
                options={FLOOR_TYPES}
                onChange={setFloorType}
                ariaLabel="상가유형 선택"
              />
            </div>
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
          {/* 좌측: 검색 결과 리스트 */}
          <div className={styles.listCol}>
          <div className={styles.resultHead}>
            <span className={styles.resultCount}>
              {selectedRegion && <>{selectedRegion} 지역 · </>}
              예산 이하 <strong>{query.data.count.toLocaleString()}곳</strong>
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
                {/* 클릭 시 바로 이동하지 않고 지도에서 해당 상권으로 포커스. 이동은 지도 팝업의 '상세 분석 보기'로. */}
                <button type="button" className={styles.row} onClick={() => setMapSelectedId(d.district_id)}>
                  <span className={styles.rank}>{safePage * PAGE_SIZE + i + 1}</span>
                  <span className={styles.rowMain}>
                    <span className={styles.name}>{d.district_name}</span>
                    <span className={styles.meta}>
                      {[d.gu_name, d.type_name, d.floor_type].filter(Boolean).join(" · ")}
                    </span>
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
            </div>
          )}
          <p className={styles.footnote}>
            추정 월 임대료 = ㎡당 임대료 × 면적
            <br />
            상권을 누르면 지도에서 위치를 보여주고, 지도 팝업의 &lsquo;상세 분석 보기&rsquo;로 이동할 수 있습니다.
          </p>
          </div>

          {/* 우측: 상권 지도(지역 분석 페이지와 동일) */}
          <div className={styles.mapCol}>
            <Suspense fallback={<PageLoader fullScreen={false} />}>
              <LeafletMap
                points={geo}
                geojson={geojsonQuery.data ?? null}
                selectedId={mapSelectedId}
                pins={pins}
                guFilter="전체"
                activeName={selectedPoint?.district_name ?? null}
                activeType={selectedPoint?.type_name ?? null}
                activeScore={toScore(selectedPoint?.district_score)}
                flyToSelectionOnMount={false}
                onSelect={setMapSelectedId}
                onOpenProfile={(id) => {
                  const p = geo.find((x) => x.id === id);
                  onPick({ id, name: p?.district_name ?? "" });
                }}
              />
            </Suspense>
          </div>
        </div>
      )}
    </div>
  );
}
