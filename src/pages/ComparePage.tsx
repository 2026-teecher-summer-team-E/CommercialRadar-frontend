import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { commercialApi } from "../services/commercialApi";
import { queryKeys, useDistrictSearch } from "../hooks/queries";
import type {
  DistrictCompareResponse,
  RadarResponse,
  DistrictTimeSeriesResponse,
  CategoryRankingResponse,
  CommercialDistrictSearchResult,
} from "../types";
import RadarChartSvg from "../components/compare/RadarChartSvg";
import type { RadarSeries } from "../components/compare/RadarChartSvg";
import LineChartSvg from "../components/compare/LineChartSvg";
import type { LineSeries } from "../components/compare/LineChartSvg";
import Legend from "../components/compare/Legend";
import ExpandModal from "../components/compare/ExpandModal";
import {
  seriesGradient,
  fmtNum,
  fmtPct,
  fmtPopulation,
} from "../components/compare/format";
import styles from "./ComparePage.module.css";

type ModalKind = "radar" | "trend" | null;
type SelectorKind = "quarter" | "category" | "ranking" | null;

interface SelectorOption {
  value: string;
  label: string;
}

interface CompareData {
  compare: DistrictCompareResponse;
  radars: RadarResponse[];
  timeSeries: DistrictTimeSeriesResponse[];
  ranking: CategoryRankingResponse | null;
}

const EXPAND_ICON = "⤢";
const MIN_DISTRICTS = 2;
const MAX_DISTRICTS = 5;
const COMPARE_PAGE_STORAGE_KEY = "commercialradar.comparePage.v1";

interface PersistedComparePageState {
  selectedIds: number[];
  selectedDistrictNames: Record<number, string>;
  selectedQuarter: string;
  selectedCategory: string;
  selectedRankingDistrictId: number | null;
  modal: ModalKind;
}

const DEFAULT_COMPARE_PAGE_STATE: PersistedComparePageState = {
  selectedIds: [1, 2, 3],
  selectedDistrictNames: {},
  selectedQuarter: "",
  selectedCategory: "",
  selectedRankingDistrictId: null,
  modal: null,
};

function readComparePageState(): PersistedComparePageState {
  if (typeof window === "undefined") return DEFAULT_COMPARE_PAGE_STATE;

  try {
    const raw = window.localStorage.getItem(COMPARE_PAGE_STORAGE_KEY);
    if (!raw) return DEFAULT_COMPARE_PAGE_STATE;

    const parsed = JSON.parse(raw) as Partial<PersistedComparePageState>;
    const selectedIds = Array.from(
      new Set(
        (Array.isArray(parsed.selectedIds) ? parsed.selectedIds : [])
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id) && id > 0),
      ),
    ).slice(0, MAX_DISTRICTS);
    const names: Record<number, string> = {};
    if (parsed.selectedDistrictNames && typeof parsed.selectedDistrictNames === "object") {
      Object.entries(parsed.selectedDistrictNames).forEach(([id, name]) => {
        const numericId = Number(id);
        if (Number.isInteger(numericId) && typeof name === "string" && name.trim()) {
          names[numericId] = name;
        }
      });
    }
    const modal = parsed.modal === "radar" || parsed.modal === "trend" ? parsed.modal : null;

    return {
      selectedIds,
      selectedDistrictNames: names,
      selectedQuarter: typeof parsed.selectedQuarter === "string" ? parsed.selectedQuarter : "",
      selectedCategory: typeof parsed.selectedCategory === "string" ? parsed.selectedCategory : "",
      selectedRankingDistrictId:
        typeof parsed.selectedRankingDistrictId === "number" &&
        selectedIds.includes(parsed.selectedRankingDistrictId)
          ? parsed.selectedRankingDistrictId
          : null,
      modal: selectedIds.length >= MIN_DISTRICTS ? modal : null,
    };
  } catch {
    return DEFAULT_COMPARE_PAGE_STATE;
  }
}

export default function ComparePage() {
  const [initialState] = useState(readComparePageState);
  const [selectedIds, setSelectedIds] = useState<number[]>(initialState.selectedIds);
  const [selectedDistrictNames, setSelectedDistrictNames] = useState<Record<number, string>>(
    initialState.selectedDistrictNames,
  );
  const [selectedQuarter, setSelectedQuarter] = useState(initialState.selectedQuarter);
  const [selectedCategory, setSelectedCategory] = useState(initialState.selectedCategory);
  const [selectedRankingDistrictId, setSelectedRankingDistrictId] = useState<number | null>(
    initialState.selectedRankingDistrictId,
  );
  const [modal, setModal] = useState<ModalKind>(initialState.modal);
  const [isAdding, setIsAdding] = useState(false);
  const [openSelector, setOpenSelector] = useState<SelectorKind>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [reportSaved, setReportSaved] = useState(false);

  useEffect(() => {
    try {
      const state: PersistedComparePageState = {
        selectedIds,
        selectedDistrictNames,
        selectedQuarter,
        selectedCategory,
        selectedRankingDistrictId,
        modal: selectedIds.length >= MIN_DISTRICTS ? modal : null,
      };
      window.localStorage.setItem(COMPARE_PAGE_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // localStorage 접근 불가 환경에서는 저장 없이 현재 화면 상태만 유지한다.
    }
  }, [selectedIds, selectedDistrictNames, selectedQuarter, selectedCategory, selectedRankingDistrictId, modal]);

  // 검색어 250ms 디바운스: 입력이 멈춘 뒤에만 쿼리 키가 바뀌어 요청이 나간다.
  const keyword = searchQuery.trim();
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(keyword), 250);
    return () => window.clearTimeout(timer);
  }, [keyword]);

  useEffect(() => {
    if (!reportSaved) return;
    const timer = window.setTimeout(() => setReportSaved(false), 2200);
    return () => window.clearTimeout(timer);
  }, [reportSaved]);

  const search = useDistrictSearch(debouncedQuery, isAdding);
  const searchResults: CommercialDistrictSearchResult[] =
    (isAdding && keyword && debouncedQuery ? search.data : undefined) ?? [];
  // 디바운스 대기 중에도 로딩으로 표시해 기존 UX(타이핑 즉시 "찾고 있습니다") 유지.
  const searchLoading = isAdding && !!keyword && (keyword !== debouncedQuery || search.isFetching);
  const searchError = search.isError;

  // 선택 상권들이 공통으로 가진 분기 목록.
  const quartersQuery = useQuery({
    queryKey: queryKeys.compareQuarters(selectedIds),
    enabled: selectedIds.length > 0,
    queryFn: async () => {
      const responses = await Promise.all(
        selectedIds.map((id) => commercialApi.timeSeries(id, { metrics: "survival_rate" })),
      );
      const commonQuarters = responses
        .map((response) => new Set(response.data.data.map((item) => item.year_quarter)))
        .reduce<Set<string>>((common, quarters, index) => {
          if (index === 0) return new Set(quarters);
          return new Set([...common].filter((quarter) => quarters.has(quarter)));
        }, new Set<string>());
      return [...commonQuarters].sort((a, b) => b.localeCompare(a));
    },
    // 상권 변경으로 재조회하는 동안 이전 목록을 유지해 선택 분기가 리셋되지 않게 한다.
    placeholderData: keepPreviousData,
  });
  const availableQuarters = selectedIds.length > 0 ? (quartersQuery.data ?? []) : [];

  // 분기 목록 갱신 시 현재 선택이 유효하지 않으면 최신 분기로 보정.
  useEffect(() => {
    if (selectedIds.length === 0) {
      setSelectedQuarter("");
      return;
    }
    const quarters = quartersQuery.data;
    if (!quarters) return;
    setSelectedQuarter((current) =>
      current && quarters.includes(current) ? current : (quarters[0] ?? ""),
    );
  }, [quartersQuery.data, selectedIds.length]);

  // 선택 상권들의 업종 목록(분기 기준).
  const categoriesQuery = useQuery({
    queryKey: queryKeys.compareCategories(selectedIds, selectedQuarter),
    enabled: selectedIds.length > 0,
    queryFn: async () => {
      const responses = await Promise.all(
        selectedIds.map((id) =>
          commercialApi.categoryStats(id, {
            year_quarter: selectedQuarter || undefined,
          }),
        ),
      );
      return Array.from(
        new Set(
          responses.flatMap((response) =>
            response.data.categories.map((category) => category.category_name),
          ),
        ),
      ).sort((a, b) => a.localeCompare(b, "ko"));
    },
    placeholderData: keepPreviousData,
  });
  const availableCategories = selectedIds.length > 0 ? (categoriesQuery.data ?? []) : [];

  // 업종 목록 갱신 시 사라진 업종이 선택돼 있으면 "전체 업종"으로 보정.
  useEffect(() => {
    if (selectedIds.length === 0) {
      setSelectedCategory("");
      return;
    }
    const categories = categoriesQuery.data;
    if (!categories) return;
    setSelectedCategory((current) => (current && !categories.includes(current) ? "" : current));
  }, [categoriesQuery.data, selectedIds.length]);

  const canCompare = selectedIds.length >= MIN_DISTRICTS;
  const effectiveRankingDistrictId =
    selectedRankingDistrictId && selectedIds.includes(selectedRankingDistrictId)
      ? selectedRankingDistrictId
      : selectedIds[0];

  useEffect(() => {
    if (selectedIds.length === 0) {
      setSelectedRankingDistrictId(null);
      return;
    }
    setSelectedRankingDistrictId((current) =>
      current && selectedIds.includes(current) ? current : selectedIds[0],
    );
  }, [selectedIds]);

  // 본문 데이터: 비교표 + 레이더 + 생존율 추이 + 업종 순위.
  const compareQuery = useQuery({
    queryKey: queryKeys.comparePage(selectedIds, selectedQuarter, selectedCategory, effectiveRankingDistrictId),
    enabled: canCompare,
    queryFn: async (): Promise<CompareData> => {
      const comparisonParams = {
        year_quarter: selectedQuarter || undefined,
        category_name: selectedCategory || undefined,
      };
      const timeSeriesParams = {
        to_quarter: selectedQuarter || undefined,
        category_name: selectedCategory || undefined,
      };

      const [compareRes, radarRes, tsRes, rankingRes] = await Promise.all([
        commercialApi.compare(selectedIds, comparisonParams),
        Promise.all(selectedIds.map((id) => commercialApi.radar(id, comparisonParams))),
        Promise.all(selectedIds.map((id) => commercialApi.timeSeries(id, timeSeriesParams))),
        effectiveRankingDistrictId
          ? commercialApi.categoryRanking(effectiveRankingDistrictId, {
              year_quarter: selectedQuarter || undefined,
            })
          : Promise.resolve(null),
      ]);

      return {
        compare: compareRes.data,
        radars: radarRes.map((r) => r.data),
        timeSeries: tsRes.map((r) => r.data),
        ranking: rankingRes ? rankingRes.data : null,
      };
    },
  });
  const data = canCompare ? (compareQuery.data ?? null) : null;
  const loading = canCompare && compareQuery.isPending;
  const error = canCompare && compareQuery.isError;

  const districts = useMemo(() => data?.compare.districts ?? [], [data]);
  useEffect(() => {
    if (districts.length === 0) return;
    setSelectedDistrictNames((current) => {
      const next = { ...current };
      districts.forEach((district) => {
        next[district.id] = district.district_name;
      });
      return next;
    });
  }, [districts]);

  useEffect(() => {
    if (selectedIds.length < MIN_DISTRICTS) setModal(null);
    if (selectedIds.length === 0) setIsAdding(false);
  }, [selectedIds.length]);

  const chipDistricts = selectedIds.map((id) => ({
    id,
    district_name: selectedDistrictNames[id] ?? `상권 ${id}`,
  }));
  const rankingDistrictOptions: SelectorOption[] = chipDistricts.map((district) => ({
    value: String(district.id),
    label: district.district_name,
  }));
  const rankingDistrictName =
    chipDistricts.find((district) => district.id === effectiveRankingDistrictId)?.district_name ??
    "선택 상권";
  const names = districts.map((d) => d.district_name);

  // 레이더: 모든 상권의 지표 라벨은 동일하다고 가정, 첫 상권 지표를 기준으로 사용.
  const radarAxes = useMemo(() => data?.radars[0]?.axes.map((a) => a.label) ?? [], [data]);
  const radarSeries: RadarSeries[] = useMemo(() => {
    if (!data) return [];
    return data.radars.map((r, i) => ({
      name: names[i] ?? `상권 ${i + 1}`,
      values: r.axes.map((a) => a.value),
    }));
  }, [data, names]);

  // 라인: 모든 상권 분기의 합집합을 정렬해 X축으로 사용.
  const trendLabels = useMemo(() => {
    if (!data) return [];
    const set = new Set<string>();
    data.timeSeries.forEach((ts) => ts.data.forEach((q) => set.add(q.year_quarter)));
    return Array.from(set).sort();
  }, [data]);

  const trendSeries: LineSeries[] = useMemo(() => {
    if (!data) return [];
    return data.timeSeries.map((ts, i) => {
      const byQuarter = new Map(ts.data.map((q) => [q.year_quarter, q.survival_rate]));
      return {
        name: names[i] ?? `상권 ${i + 1}`,
        points: trendLabels.map((label) => byQuarter.get(label) ?? null),
      };
    });
  }, [data, names, trendLabels]);

  const removeDistrict = (id: number) => {
    setSelectedIds((current) => current.filter((selectedId) => selectedId !== id));
  };

  const addDistrict = (district: CommercialDistrictSearchResult) => {
    if (selectedIds.includes(district.id) || selectedIds.length >= MAX_DISTRICTS) return;
    setSelectedDistrictNames((current) => ({ ...current, [district.id]: district.district_name }));
    setSelectedIds((current) => [...current, district.id]);
    setSearchQuery("");
    setIsAdding(false);
  };

  const toggleAddPanel = () => {
    if (selectedIds.length >= MAX_DISTRICTS) return;
    setIsAdding((current) => !current);
    setSearchQuery("");
  };

  const activeQuarter = selectedQuarter || data?.compare.year_quarter || "";
  const filterSummary = `${formatQuarter(activeQuarter)} · ${selectedCategory || "전체 업종"}`;
  const quarterOptions: SelectorOption[] = availableQuarters.map((quarter) => ({
    value: quarter,
    label: formatQuarter(quarter),
  }));
  const categoryOptions: SelectorOption[] = [
    { value: "", label: "전체 업종" },
    ...availableCategories.map((category) => ({ value: category, label: category })),
  ];

  return (
    <div className={styles.page}>
      <Header onSaveReport={() => setReportSaved(true)} reportSaved={reportSaved} />

      {/* 컨트롤 바 */}
      <div className={styles.controlBar}>
        <div className={styles.chips}>
          {chipDistricts.map((d, i) => (
            <span key={d.id} className={styles.chip}>
              <span className={styles.chipDot} style={{ background: seriesGradient(i) }} />
              {d.district_name}
              <button
                type="button"
                className={styles.chipClose}
                aria-label={`${d.district_name} 제거`}
                onClick={() => removeDistrict(d.id)}
                title="상권 제거"
              >
                ×
              </button>
            </span>
          ))}
          <button
            type="button"
            className={styles.addChip}
            onClick={toggleAddPanel}
            disabled={selectedIds.length >= MAX_DISTRICTS}
            aria-expanded={isAdding}
            title={selectedIds.length >= MAX_DISTRICTS ? "상권은 최대 5개까지 비교할 수 있습니다" : "비교할 상권 추가"}
          >
            + 상권 추가
          </button>
        </div>
        <div className={styles.selectors}>
          <FilterDropdown
            label="기준 분기"
            value={selectedQuarter}
            options={quarterOptions}
            disabled={availableQuarters.length === 0}
            open={openSelector === "quarter"}
            onToggle={() => setOpenSelector((current) => (current === "quarter" ? null : "quarter"))}
            onClose={() => setOpenSelector(null)}
            onChange={setSelectedQuarter}
          />
          <FilterDropdown
            label="비교 업종"
            value={selectedCategory}
            options={categoryOptions}
            disabled={availableCategories.length === 0}
            open={openSelector === "category"}
            onToggle={() => setOpenSelector((current) => (current === "category" ? null : "category"))}
            onClose={() => setOpenSelector(null)}
            onChange={setSelectedCategory}
          />
        </div>

        {isAdding && (
          <div className={styles.addPanel}>
            <div className={styles.searchWrap}>
              <span className={styles.searchIcon} aria-hidden>⌕</span>
              <input
                className={styles.searchInput}
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="상권명, 자치구, 행정동으로 검색"
                aria-label="추가할 상권 검색"
                autoFocus
              />
              <button type="button" className={styles.cancelAddBtn} onClick={toggleAddPanel}>
                취소
              </button>
            </div>

            <div className={styles.searchResults} role="listbox" aria-label="상권 검색 결과">
              {!searchQuery.trim() && (
                <p className={styles.searchMessage}>비교할 상권을 검색해 선택하세요.</p>
              )}
              {searchQuery.trim() && searchLoading && (
                <p className={styles.searchMessage}>상권을 찾고 있습니다…</p>
              )}
              {searchQuery.trim() && !searchLoading && searchError && (
                <p className={styles.searchMessage}>검색 결과를 불러오지 못했습니다.</p>
              )}
              {searchQuery.trim() && !searchLoading && !searchError && searchResults.length === 0 && (
                <p className={styles.searchMessage}>일치하는 상권이 없습니다.</p>
              )}
              {!searchLoading &&
                searchResults.map((result) => {
                  const alreadySelected = selectedIds.includes(result.id);
                  const location = [result.gu_name, result.dong_name, result.type_name]
                    .filter(Boolean)
                    .join(" · ");

                  return (
                    <button
                      type="button"
                      className={styles.searchResult}
                      key={result.id}
                      onClick={() => addDistrict(result)}
                      disabled={alreadySelected}
                      role="option"
                      aria-selected={alreadySelected}
                    >
                      <span>
                        <strong>{result.district_name}</strong>
                        {location && <small>{location}</small>}
                      </span>
                      {alreadySelected && <span className={styles.resultAction}>선택됨</span>}
                    </button>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      {selectedIds.length === 0 && (
        <div className={styles.emptyState}>
          <h2>비교할 상권을 추가하세요</h2>
          <p>상권을 선택하면 아래에 지표표, 레이더, 업종 순위, 생존율 추이가 표시됩니다.</p>
        </div>
      )}

      {selectedIds.length === 1 && (
        <div className={styles.emptyState}>
          <h2>상권을 1개 더 추가하세요</h2>
          <p>상권 비교 데이터는 2개 이상 선택했을 때 표시됩니다.</p>
        </div>
      )}

      {loading && (
        <div className={styles.skeletonWrap}>
          <div className={styles.skeleton} />
          <div className={styles.skeleton} />
          <div className={styles.skeleton} />
        </div>
      )}

      {canCompare && !loading && (error || !data) && (
        <div className={styles.empty}>비교 데이터를 받아오지 못했습니다. 페이지를 새로고침해보세요.</div>
      )}

      {/* 핵심 지표 비교표 */}
      {canCompare && !loading && !error && data && (
        <>
      <section className={styles.section}>
        <SectionTitle title="핵심 지표 비교" subtitle={`${filterSummary} 기준`} />
        <div className={styles.card}>
          <MetricsTable districts={districts} />
        </div>
      </section>

      {/* 차트 2열 */}
      <section className={styles.chartsGrid}>
        <div className={styles.card}>
          <ChartHeader title="지표별 환산 점수" onExpand={() => setModal("radar")} />
          {radarSeries.length > 0 && radarAxes.length >= 3 ? (
            <div className={styles.chartBody}>
              <RadarChartSvg axes={radarAxes} series={radarSeries} />
            </div>
          ) : (
            <div className={styles.empty}>레이더 차트를 그릴 데이터가 부족합니다.</div>
          )}
          <Legend names={names} />
        </div>

        <div className={styles.card}>
          <div className={styles.rankingHeader}>
            <SectionTitle
              title="업종별 추천 순위"
              subtitle={
                effectiveRankingDistrictId
                  ? `${formatQuarter(activeQuarter)} · ${rankingDistrictName} 기준`
                  : "선택 상권 기준 상위 업종"
              }
              showAccent={false}
            />
            <FilterDropdown
              label="순위 기준"
              value={effectiveRankingDistrictId ? String(effectiveRankingDistrictId) : ""}
              options={rankingDistrictOptions}
              disabled={rankingDistrictOptions.length === 0}
              open={openSelector === "ranking"}
              onToggle={() => setOpenSelector((current) => (current === "ranking" ? null : "ranking"))}
              onClose={() => setOpenSelector(null)}
              onChange={(value) => setSelectedRankingDistrictId(Number(value))}
              compact
            />
          </div>
          <RankingTable ranking={data.ranking} />
        </div>
      </section>

      {/* 생존율 추이: 그래프가 길쭉해서 2열보단 전체 폭 차지가 낫다. */}
      <section className={styles.section}>
        <div className={styles.card}>
          <ChartHeader
            title="생존율 추이"
            subtitle={selectedCategory || "전체 업종"}
            onExpand={() => setModal("trend")}
          />
          <div className={styles.legendTop}>
            <Legend names={names} />
          </div>
          {trendLabels.length > 0 ? (
            <div className={styles.chartBody}>
              <LineChartSvg labels={trendLabels} series={trendSeries} width={680} height={340} />
            </div>
          ) : (
            <div className={styles.empty}>생존율 추이 기록이 아직 없습니다.</div>
          )}
        </div>
      </section>

      {/* 확대 모달 */}
      {modal === "radar" && radarAxes.length >= 3 && (
        <ExpandModal
          title="지표별 환산 점수"
          subtitle="상권별 5개 지표 비교"
          onClose={() => setModal(null)}
        >
          <div className={styles.modalChart}>
            <RadarChartSvg axes={radarAxes} series={radarSeries} size={420} />
          </div>
          <RadarValueTable axes={radarAxes} series={radarSeries} />
          <ScoreCriteria />
        </ExpandModal>
      )}

      {modal === "trend" && trendLabels.length > 0 && (
        <ExpandModal
          title="생존율 추이"
          subtitle={`${filterSummary}까지의 상권별 생존율(%) 추이`}
          onClose={() => setModal(null)}
        >
          <div className={styles.modalChartWide}>
            <div className={styles.legendTop}>
              <Legend names={names} />
            </div>
            <LineChartSvg labels={trendLabels} series={trendSeries} width={860} height={420} />
          </div>
        </ExpandModal>
      )}
        </>
      )}
    </div>
  );
}

function formatQuarter(quarter: string) {
  const match = /^(\d{4})-Q([1-4])$/.exec(quarter);
  return match ? `${match[1]}년 ${match[2]}분기` : quarter || "기준 분기 없음";
}

function Header({ onSaveReport, reportSaved }: { onSaveReport: () => void; reportSaved: boolean }) {
  return (
    <div className={styles.header}>
      <div>
        <h1 className={styles.title}>상권 비교</h1>
        <p className={styles.subtitle}>나란히 놓으면 보이는 것들이 있습니다</p>
      </div>
      <div className={styles.saveArea}>
      <button type="button" className={styles.saveBtn} onClick={onSaveReport}>
        리포트로 저장
      </button>
        {reportSaved && (
          <div className={styles.saveNotice} role="status" aria-live="polite">
            리포트가 저장됐습니다.
          </div>
        )}
      </div>
    </div>
  );
}

function SectionTitle({
  title,
  subtitle,
  showAccent = true,
}: {
  title: string;
  subtitle?: string;
  showAccent?: boolean;
}) {
  return (
    <div className={styles.sectionTitle}>
      {showAccent && <span className={styles.accentBar} />}
      <div>
        <h2 className={styles.sectionHeading}>{title}</h2>
        {subtitle && <p className={styles.sectionSub}>{subtitle}</p>}
      </div>
    </div>
  );
}

function ChartHeader({
  title,
  subtitle,
  onExpand,
}: {
  title: string;
  subtitle?: string;
  onExpand: () => void;
}) {
  return (
    <div className={styles.chartHeader}>
      <div>
        <h3 className={styles.chartTitle}>{title}</h3>
        {subtitle && <p className={styles.chartSubTitle}>{subtitle}</p>}
      </div>
      <button type="button" className={styles.expandBtn} onClick={onExpand} aria-label={`${title} 확대`}>
        {EXPAND_ICON}
      </button>
    </div>
  );
}

function FilterDropdown({
  label,
  value,
  options,
  disabled,
  open,
  onToggle,
  onClose,
  onChange,
  compact = false,
}: {
  label: string;
  value: string;
  options: SelectorOption[];
  disabled: boolean;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  const selectedLabel = options.find((option) => option.value === value)?.label ?? options[0]?.label ?? "-";

  return (
    <div
      className={`${styles.selectorDropdown} ${compact ? styles.selectorDropdownCompact : ""}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onClose();
      }}
    >
      <button
        type="button"
        className={styles.selectorTrigger}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className={styles.selectorLabel}>{label}</span>
        <span className={styles.selectorValue}>{selectedLabel}</span>
        <span className={styles.selectorArrow} aria-hidden>
          ▾
        </span>
      </button>
      {open && !disabled && (
        <div className={styles.selectorMenu} role="listbox" aria-label={label}>
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value || "all"}
                type="button"
                className={`${styles.selectorOption} ${selected ? styles.selectorOptionActive : ""}`}
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(option.value);
                  onClose();
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ScoreCriteria() {
  return (
    <aside className={styles.scoreCriteria} aria-label="점수 산출 기준">
      <h3>점수 산출 기준</h3>
      <div className={styles.criteriaGrid}>
        <div>
          <strong>생존율</strong>
          <p>생존율 그대로</p>
          <small>선택한 분기·업종의 생존율을 사용합니다.</small>
        </div>
        <div>
          <strong>유동인구</strong>
          <p>총 유동인구 ÷ 300만 × 100</p>
          <small>선택 분기의 상권 전체 유동인구를 기준 상한 대비 점수화합니다.</small>
        </div>
        <div>
          <strong>매출</strong>
          <p>log10(총매출 + 1) ÷ 12 × 100</p>
          <small>매출 규모 차이가 커지지 않도록 로그 스케일을 적용합니다.</small>
        </div>
        <div>
          <strong>안정성</strong>
          <p>100 - 폐업률</p>
          <small>폐업률이 낮을수록 안정성 점수가 높아집니다.</small>
        </div>
        <div>
          <strong>성장성</strong>
          <p>개업률 × 5</p>
          <small>개업률 20%를 100점으로 환산합니다.</small>
        </div>
      </div>
    </aside>
  );
}

/** 핵심 지표 비교표. 지표별 최고값 셀을 하이라이트. */
function MetricsTable({ districts }: { districts: DistrictCompareResponse["districts"] }) {
  // 각 지표에서 "최고(=가장 좋음)" 인덱스 계산. 폐업위험은 낮을수록 좋음.
  const bestIndex = (
    values: Array<number | null>,
    mode: "max" | "min",
  ): number => {
    let best = -1;
    let bestVal: number | null = null;
    values.forEach((v, i) => {
      if (v == null) return;
      if (bestVal == null || (mode === "max" ? v > bestVal : v < bestVal)) {
        bestVal = v;
        best = i;
      }
    });
    return best;
  };

  const scores = districts.map((d) => d.district_score);
  const survivals = districts.map((d) => d.survival_rate);
  const openRates = districts.map((d) => d.open_rate);
  const populations = districts.map((d) => d.avg_population);

  const rows = [
    {
      label: "종합 점수",
      best: bestIndex(scores, "max"),
      cells: districts.map((d) => fmtNum(d.district_score, 1)),
    },
    {
      label: "생존율",
      best: bestIndex(survivals, "max"),
      cells: districts.map((d) => fmtPct(d.survival_rate)),
    },
    {
      label: "개업률",
      best: bestIndex(openRates, "max"),
      cells: districts.map((d) => fmtPct(d.open_rate)),
    },
    {
      label: "유동인구",
      best: bestIndex(populations, "max"),
      cells: districts.map((d) => fmtPopulation(d.avg_population)),
    },
  ];

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th className={styles.metricCol}>지표</th>
          {districts.map((d, i) => (
            <th key={d.id} className={styles.numCell}>
              <span className={styles.thDot} style={{ background: seriesGradient(i) }} />
              {d.district_name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <td className={styles.metricCol}>{row.label}</td>
            {row.cells.map((cell, i) => (
              <td key={i} className={`${styles.numCell} ${i === row.best ? styles.bestCell : ""}`}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** 레이더 확대 모달의 지표별 값 테이블. 지표마다 최고값 시리즈색 강조. */
function RadarValueTable({ axes, series }: { axes: string[]; series: RadarSeries[] }) {
  return (
    <>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.metricCol}>지표</th>
            {series.map((s, i) => (
              <th key={i} className={styles.numCell}>
                <span className={styles.thDot} style={{ background: seriesGradient(i) }} />
                {s.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {axes.map((axis, ai) => {
            const vals = series.map((s) => s.values[ai] ?? null);
            let best = -1;
            let bestVal: number | null = null;
            vals.forEach((v, i) => {
              if (v == null) return;
              if (bestVal == null || v > bestVal) {
                bestVal = v;
                best = i;
              }
            });
            return (
              <tr key={axis}>
                <td className={styles.metricCol}>{axis}</td>
                {vals.map((v, i) => (
                  <td key={i} className={`${styles.numCell} ${i === best ? styles.bestCell : ""}`}>
                    {fmtNum(v, 0)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className={styles.scoreUnitNote}>단위: 점</div>
    </>
  );
}

/** 업종별 추천 순위표. */
function RankingTable({ ranking }: { ranking: CategoryRankingResponse | null }) {
  if (!ranking || ranking.ranking.length === 0) {
    return <div className={styles.empty}>업종 순위 데이터가 없어요.</div>;
  }
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th className={styles.rankCol}>순위</th>
          <th className={styles.leftCell}>업종</th>
          <th className={styles.numCell}>생존율</th>
          <th className={styles.numCell}>점포수</th>
          <th className={styles.numCell}>점수</th>
        </tr>
      </thead>
      <tbody>
        {ranking.ranking.map((item) => (
          <tr key={`${item.rank}-${item.category_name ?? ""}`}>
            <td className={styles.rankCol}>{item.rank}</td>
            <td className={styles.leftCell}>{item.category_name ?? "-"}</td>
            <td className={styles.numCell}>{fmtPct(item.survival_rate)}</td>
            <td className={styles.numCell}>
              {item.total_business != null ? item.total_business.toLocaleString("ko-KR") : "-"}
            </td>
            <td className={styles.numCell}>{fmtNum(item.district_score, 1)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
