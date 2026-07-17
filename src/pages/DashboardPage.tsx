import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../lib/apiClient";
import { commercialApi } from "../services/commercialApi";
import { mlApi } from "../services/mlApi";
import type {
  RadarResponse,
  PopulationHeatmapResponse,
  DistrictTimeSeriesResponse,
  SurvivalForecastResponse,
  TimeseriesPoint,
  AgeSlice,
} from "../types";
import type { ForecastPoint } from "../components/charts/ForecastChart";
import type { DistrictSearchResult } from "../components/map/mapData";
import ScoreCard from "../components/dashboard/ScoreCard";
import SurvivalCard from "../components/dashboard/SurvivalCard";
import ScenarioSimBox from "../components/dashboard/ScenarioSimBox";
import PopulationHeatmap from "../components/dashboard/PopulationHeatmap";
import AgeGenderCard from "../components/dashboard/AgeGenderCard";
import RentCard from "../components/dashboard/RentCard";
import type { RentBar } from "../components/dashboard/RentCard";
import RentForecastCard from "../components/dashboard/RentForecastCard";
import SalesForecastCard from "../components/dashboard/SalesForecastCard";
import { DayNightCard, ForeignCard, PerCapitaCard, PopulationRhythmCard, WeekendCard } from "../components/dashboard/StatCards";
import ExpandModal from "../components/dashboard/ExpandModal";
import { quarterShort } from "../components/dashboard/format";
import { useFavoriteDistrict } from "../hooks/useFavoriteDistrict";
import { queryKeys, useCategoryRanking, useDistrictSearch } from "../hooks/queries";
import FavoriteStar from "../components/common/FavoriteStar";
import PageLoader from "../components/common/PageLoader";
import styles from "./DashboardPage.module.css";

// recharts + lottie가 들어있어 무거움 — 시나리오 클릭(모달) 시점에만 로드.
const AtmosphereSimulation = lazy(() => import("../components/charts/AtmosphereSimulation"));

// 임대료 예측은 상가유형별 독립 시계열이라 대표 유형 하나만 보여준다. 백엔드 기본값과 동일하게
// 표본이 가장 많은 중대형을 쓴다(app/routers/ml.py DEFAULT_RENT_FLOOR_TYPE).
const RENT_FORECAST_FLOOR_TYPE = "중대형";

/** getDistrict 응답(서비스가 제네릭 없이 any 반환) — 페이지 내부 로컬 타입. */
interface DistrictLatestStats {
  year_quarter: string | null;
  district_score: number | null;
  survival_rate: number | null;
  closure_rate: number | null;
  total_business: number | null;
  // 종합점수 순위(백엔드 제공). 데이터 없으면 null → "지표없음".
  score_rank?: number | null;
  score_rank_total?: number | null;
  score_percentile?: number | null;
  rank_scope?: "seoul" | "gu" | "type" | null;
}
interface DistrictDetail {
  id: number;
  district_name: string;
  type_name: string | null;
  gu_name: string | null;
  dong_name: string | null;
  avg_population: number | null;
  latest_stats: DistrictLatestStats | null;
}

/** 임대료 응답(전용 서비스 없음). avg_rent_per_sqm 는 천원/㎡ 단위(R-ONE 원본). */
interface RentStat {
  floor_type: string | null;
  avg_rent_per_sqm: number | null;
}
interface RentResponse {
  district_id: number;
  year_quarter: string | null;
  rent_stats: RentStat[];
}

/** 외국인 비중 응답(GET /api/commercial-districts/{id}/foreign-ratio). */
interface ForeignRatioResponse {
  district_id: number;
  foreigner_pct: number | null;
  foreigner_count: number | null;
  total_count: number | null;
}

/** 주말/낮밤 유동인구 비중(GET /api/commercial-districts/{id}/population-ratios). */
interface PopulationRatiosResponse {
  district_id: number;
  weekend_pct: number | null;
  daytime_pct: number | null;
  nighttime_pct: number | null;
}

/** 시간대별 매출 낮/밤(GET /api/commercial-districts/{id}/sales-time-bands). */
interface SalesTimeBandsResponse {
  district_id: number;
  year_quarter: string | null;
  daytime_sales: number | null;
  nighttime_sales: number | null;
  daytime_pct: number | null;
  nighttime_pct: number | null;
  bands: Record<string, number> | null;
}

/** 인당매출(GET /api/commercial-districts/{id}/per-capita-sales). */
interface PerCapitaSalesResponse {
  district_id: number;
  year_quarter: string | null;
  total_sales: number | null;
  population: number | null;
  per_capita_sales: number | null;
}

interface DashboardData {
  district: DistrictDetail | null;
  radar: RadarResponse | null;
  heatmap: PopulationHeatmapResponse | null;
  tsAge: DistrictTimeSeriesResponse | null;
  tsGender: DistrictTimeSeriesResponse | null;
  tsSales: DistrictTimeSeriesResponse | null;
  forecast: SurvivalForecastResponse | null;
  rent: RentResponse | null;
  foreign: ForeignRatioResponse | null;
  popRatios: PopulationRatiosResponse | null;
  salesBands: SalesTimeBandsResponse | null;
  perCapita: PerCapitaSalesResponse | null;
}

/** allSettled 결과에서 값만 안전 추출. */
function pick<T>(r: PromiseSettledResult<{ data: T }>): T | null {
  return r.status === "fulfilled" ? r.value.data : null;
}

/** 최신 분기의 population.breakdown[dimension] 추출 ({slot: value}). */
function lastBreakdown(ts: DistrictTimeSeriesResponse | null, dim: string): Record<string, number> | null {
  const rows = ts?.data ?? [];
  if (rows.length === 0) return null;
  const last = rows[rows.length - 1];
  const bd = last.population?.breakdown ?? null;
  return bd?.[dim] ?? null;
}

/** 대시보드 12개 API 병렬 호출. 상권 상세 실패만 페이지 에러, 나머지는 null 로 진행(allSettled). */
async function fetchDashboard(id: number): Promise<DashboardData> {
  const [
    districtR,
    radarR,
    heatmapR,
    tsAgeR,
    tsGenderR,
    tsSalesR,
    forecastR,
    rentR,
    foreignR,
    popRatiosR,
    salesBandsR,
    perCapitaR,
  ] = await Promise.allSettled([
    commercialApi.getDistrict(id),
    commercialApi.radar(id),
    commercialApi.heatmap(id),
    commercialApi.timeSeries(id, { metrics: "population", breakdown: "age" }),
    commercialApi.timeSeries(id, { metrics: "population", breakdown: "gender" }),
    commercialApi.timeSeries(id, { metrics: "sales" }),
    mlApi.survivalForecast(id),
    apiClient.get<RentResponse>(`/api/commercial-districts/${id}/rent`),
    apiClient.get<ForeignRatioResponse>(`/api/commercial-districts/${id}/foreign-ratio`),
    apiClient.get<PopulationRatiosResponse>(`/api/commercial-districts/${id}/population-ratios`),
    apiClient.get<SalesTimeBandsResponse>(`/api/commercial-districts/${id}/sales-time-bands`),
    apiClient.get<PerCapitaSalesResponse>(`/api/commercial-districts/${id}/per-capita-sales`),
  ]);

  const district = pick<DistrictDetail>(districtR);
  if (!district) throw new Error(`상권 ${id} 조회 실패`);

  return {
    district,
    radar: pick<RadarResponse>(radarR),
    heatmap: pick<PopulationHeatmapResponse>(heatmapR),
    tsAge: pick<DistrictTimeSeriesResponse>(tsAgeR),
    tsGender: pick<DistrictTimeSeriesResponse>(tsGenderR),
    tsSales: pick<DistrictTimeSeriesResponse>(tsSalesR),
    forecast: pick<SurvivalForecastResponse>(forecastR),
    rent: pick<RentResponse>(rentR),
    foreign: pick<ForeignRatioResponse>(foreignR),
    popRatios: pick<PopulationRatiosResponse>(popRatiosR),
    salesBands: pick<SalesTimeBandsResponse>(salesBandsR),
    perCapita: pick<PerCapitaSalesResponse>(perCapitaR),
  };
}

export default function DashboardPage() {
  const { districtCode } = useParams();
  const navigate = useNavigate();
  const id = useMemo<number | null>(() => {
    const n = Number(districtCode);
    return districtCode && Number.isFinite(n) && n > 0 ? n : null;
  }, [districtCode]);

  const [modal, setModal] = useState<"heatmap" | null>(null);
  const [sim, setSim] = useState<"low" | "mid" | "high" | null>(null);
  // 생존율 예측 업종 필터. null = 전체 상권(기존 기본 동작).
  const [selCategory, setSelCategory] = useState<string | null>(null);

  // 상단 검색 바(지역 분석 페이지와 동일한 스타일) — 검색해서 다른 상권 상세로 바로 이동.
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const searchBarRef = useRef<HTMLDivElement | null>(null);
  const keyword = query.trim();
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(keyword), 300);
    return () => clearTimeout(t);
  }, [keyword]);
  const searchQuery = useDistrictSearch(debouncedQuery);
  const searchOptions: DistrictSearchResult[] =
    (keyword && debouncedQuery ? searchQuery.data : undefined) ?? [];
  const handlePickSearch = (result: DistrictSearchResult) => {
    setQuery("");
    setSearchFocused(false);
    navigate(`/dashboard/${result.id}`);
  };
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchOptions.length > 0) handlePickSearch(searchOptions[0]);
  };
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

  const dashboardQuery = useQuery({
    queryKey: queryKeys.dashboard(id ?? -1),
    queryFn: () => fetchDashboard(id as number),
    enabled: id != null,
  });
  const data = dashboardQuery.data ?? null;
  const loading = id != null && dashboardQuery.isPending;
  const error = id == null || dashboardQuery.isError;

  // 업종 옵션 + 폴백 현재값(0~100) 소스: 업종 랭킹.
  const rankingQuery = useCategoryRanking(id ?? -1);
  const rankingItems = useMemo(
    () => (id != null ? (rankingQuery.data?.ranking ?? []) : []),
    [id, rankingQuery.data],
  );
  // total_business 순 상위 30개 업종명(예측/폴백 조회 대상).
  const categoryOptions = useMemo(() => {
    const names = rankingItems
      .filter((it) => it.category_name != null)
      .sort((a, b) => (b.total_business ?? 0) - (a.total_business ?? 0))
      .slice(0, 30)
      .map((it) => it.category_name as string);
    return [...new Set(names)];
  }, [rankingItems]);
  // 업종명 → 현재 생존율(0~100). 예측이 비었을 때 폴백값으로 사용.
  const rankingSurvivalMap = useMemo(() => {
    const m = new Map<string, number>();
    rankingItems.forEach((it) => {
      if (it.category_name != null && it.survival_rate != null) m.set(it.category_name, it.survival_rate);
    });
    return m;
  }, [rankingItems]);

  // 선택 업종의 예측 곡선. 전체 상권(null)일 땐 요청하지 않고 기존 data.forecast를 그대로 쓴다.
  const categoryForecastQuery = useQuery({
    queryKey: ["survival-forecast", id ?? -1, selCategory ?? ""] as const,
    queryFn: () => mlApi.survivalForecast(id as number, { category_name: selCategory as string }).then((r) => r.data),
    enabled: id != null && selCategory != null,
  });

  // 선택 업종의 현재 지표(생존율·폐업률·매장수·점수). 종합점수/생존율 예측 카드의 좌측 수치 갱신용.
  const categoryStatsQuery = useQuery({
    queryKey: ["category-stats", id ?? -1, selCategory ?? ""] as const,
    queryFn: () => commercialApi.categoryStats(id as number, { category_name: selCategory as string }).then((r) => r.data),
    enabled: id != null && selCategory != null,
  });

  // 매출 예측(업종 선택 시 그 업종, 아니면 상권 전체 __ALL__). 생존율 예측과 같은 대상.
  const salesForecastQuery = useQuery({
    queryKey: ["sales-forecast", id ?? -1, selCategory ?? ""] as const,
    queryFn: () =>
      mlApi.salesForecast(id as number, selCategory != null ? { category_name: selCategory } : undefined).then((r) => r.data),
    enabled: id != null,
  });

  // 임대료 예측(대표 유형 = 중대형). 매출 예측과 같은 대상 단위(상권 하나)의 단일 시계열.
  const rentForecastQuery = useQuery({
    queryKey: ["rent-forecast", id ?? -1] as const,
    queryFn: () => mlApi.rentForecast(id as number, { floor_type: RENT_FORECAST_FLOOR_TYPE }).then((r) => r.data),
    enabled: id != null,
  });

  // ── 파생 값 ─────────────────────────────────────────────
  const d = data?.district ?? null;
  const stats = d?.latest_stats ?? null;

  // 활성 지표: 전체 상권(null)은 상권 latest_stats, 업종 선택 시 그 업종의 category-stats로 교체.
  // 유동인구·연령/성별·임대료 등 업종별 데이터가 없는 지표는 상권 전체값을 그대로 둔다.
  const catStat = categoryStatsQuery.data?.categories?.[0] ?? null;
  const activeStats = useMemo(() => {
    if (selCategory == null || catStat == null) return stats;
    return {
      ...stats,
      survival_rate: catStat.survival_rate,
      closure_rate: catStat.closure_rate,
      total_business: catStat.total_business,
      district_score: catStat.district_score,
      year_quarter: categoryStatsQuery.data?.year_quarter ?? stats?.year_quarter ?? null,
    };
  }, [selCategory, catStat, stats, categoryStatsQuery.data]);

  // 생존율 예측 API는 survival_rate를 비율(0~1)로 반환하지만 latest_stats는 퍼센트(0~100)다.
  // 단위를 %로 통일한다(비율이면 ×100).
  const toPct = (v: number | null | undefined): number | null =>
    v == null ? null : v <= 1 ? v * 100 : v;

  // 업종 예측 로딩 중에는 폴백 판정을 보류(빈 예측을 폴백으로 오인해 깜빡이지 않게).
  const categoryForecastLoading = selCategory != null && categoryForecastQuery.isPending;

  // 활성 예측 결정: 전체 상권(null)은 기존 data.forecast, 업종 선택 시 그 업종 예측.
  // 업종 예측이 비어 있으면 랭킹의 현재 생존율(0~100)로 폴백(차트 없이 현재값만 표시).
  const { activeForecastRaw, fallbackCurrentPct } = useMemo(() => {
    if (selCategory == null) {
      return { activeForecastRaw: data?.forecast?.forecast ?? [], fallbackCurrentPct: null as number | null };
    }
    const catFc = categoryForecastQuery.data?.forecast ?? [];
    if (catFc.length > 0) return { activeForecastRaw: catFc, fallbackCurrentPct: null as number | null };
    return { activeForecastRaw: [], fallbackCurrentPct: rankingSurvivalMap.get(selCategory) ?? null };
  }, [selCategory, data, categoryForecastQuery.data, rankingSurvivalMap]);

  // 폴백 활성 여부: 업종 선택 + 로딩 완료 + 예측 없음 + 현재값 존재.
  const isFallback =
    selCategory != null && !categoryForecastLoading && activeForecastRaw.length === 0 && fallbackCurrentPct != null;
  const fallbackNote = isFallback ? "이 업종은 예측 준비 중이라 현재 생존율을 표시합니다." : null;

  const forecastPoints: ForecastPoint[] = useMemo(() => {
    const fc = activeForecastRaw;
    const pts: ForecastPoint[] = [];
    if (activeStats?.survival_rate != null && activeStats.year_quarter) {
      pts.push({ label: quarterShort(activeStats.year_quarter), value: activeStats.survival_rate, forecast: false });
    }
    fc.forEach((p) => {
      pts.push({
        label: quarterShort(p.year_quarter),
        value: toPct(p.survival_rate), // 기본(P50)
        low: toPct(p.low), // 비관(P10)
        high: toPct(p.high), // 낙관(P90)
        forecast: true,
      });
    });
    return pts;
  }, [activeForecastRaw, activeStats]);

  // GangnamForecastChart용 시계열(unit="ratio" → 0~1 스케일 필수).
  // latest_stats.survival_rate는 0~100 이므로 /100. forecast는 이미 0~1.
  // 누적 생존율: 창업 시점=100%, 분기별 생존율(0~1)을 복리로 곱해 점점 감소.
  // 낙관(high)·비관(low) 밴드도 각각 누적해 시간이 갈수록 벌어진다.
  const survivalCum = useMemo(() => {
    const fc = activeForecastRaw;
    const anchorQ = activeStats?.year_quarter ?? null;
    const history: TimeseriesPoint[] = anchorQ ? [{ year_quarter: anchorQ, value: 1 }] : [];
    let cv = 1;
    let cl = 1;
    let ch = 1;
    const forecast: TimeseriesPoint[] = fc.map((p) => {
      const r = p.survival_rate ?? 1;
      cv *= r;
      cl *= p.low ?? r;
      ch *= p.high ?? r;
      return { year_quarter: p.year_quarter, value: cv, low: cl, mid: cv, high: ch };
    });
    return { history, forecast, finalPct: forecast.length > 0 ? cv * 100 : null };
  }, [activeForecastRaw, activeStats]);
  const survivalHistory = survivalCum.history;
  const survivalForecast = survivalCum.forecast;

  // 매출 예측 시계열(value=분기 총매출 원). 업종 선택 시 그 업종, 아니면 상권 전체.
  const salesForecastSeries = useMemo<TimeseriesPoint[]>(() => {
    const fc = salesForecastQuery.data?.forecast ?? [];
    return fc
      .filter((p) => p.total_sales != null)
      .map((p) => ({ year_quarter: p.year_quarter, value: p.total_sales, low: p.low, mid: p.total_sales, high: p.high }));
  }, [salesForecastQuery.data]);
  const salesFallbackNote =
    selCategory != null && !salesForecastQuery.isPending && salesForecastSeries.length === 0
      ? "이 업종은 매출 예측 준비 중입니다."
      : null;
  const salesCategoryLabel = selCategory ?? "전체 상권";

  // 매출 예측 시작 앵커: 직전 분기(2025-Q4) 실적 한 점. 세 시나리오(p10/p50/p90)가 모두 여기서 출발한다.
  // 업종 선택 시 그 업종 실적(category-stats total_sales), 전체 상권은 매출 실적 시계열의 최신 분기.
  const salesHistory = useMemo<TimeseriesPoint[]>(() => {
    if (selCategory != null) {
      const q = categoryStatsQuery.data?.year_quarter ?? stats?.year_quarter ?? null;
      const v = catStat?.total_sales ?? null;
      return q != null && v != null ? [{ year_quarter: q, value: v }] : [];
    }
    const rows = data?.tsSales?.data ?? [];
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i].sales != null) return [{ year_quarter: rows[i].year_quarter, value: rows[i].sales }];
    }
    return [];
  }, [selCategory, categoryStatsQuery.data, catStat, data?.tsSales]);

  // 카드 헤로: 폴백이면 현재 생존율만, 아니면 창업 시점 100% → 4분기 후 누적 생존율.
  const survivalStartPct = isFallback ? fallbackCurrentPct : survivalHistory.length > 0 ? 100 : null;
  const forecastNextPct = isFallback ? null : survivalCum.finalPct;
  const forecastDelta =
    survivalStartPct != null && forecastNextPct != null
      ? Number((forecastNextPct - survivalStartPct).toFixed(1))
      : null;

  // 연령 분포(실데이터, dimension="age"). 성별 marginal 은 {남성:총,여성:총} 총량뿐이라
  // 연령×성별 세부는 DB 에 없다 — AgeGenderCard는 연령 분포만 표시하고, 성비는 별도 배지로 보여준다.
  const ageDist = useMemo(() => lastBreakdown(data?.tsAge ?? null, "age") ?? null, [data]);

  // AtmosphereSimulation용 연령 구성비(라벨명 유지 — "60대이상" 색 지원됨).
  const ageSlices: AgeSlice[] = useMemo(() => {
    if (!ageDist) return [];
    const total = Object.values(ageDist).reduce((s, v) => s + v, 0);
    if (total <= 0) return [];
    return Object.entries(ageDist).map(([name, v]) => ({ name, pct: Math.round((v / total) * 100) }));
  }, [ageDist]);

  // 시나리오별 최종 누적 생존율 %(low/mid/high) — AtmosphereSimulation 점포 불빛 실데이터.
  const survivalScenarioPct = useMemo(() => {
    const last = survivalForecast[survivalForecast.length - 1];
    if (!last) return null;
    return {
      low: (last.low ?? last.value ?? 0) * 100,
      mid: (last.value ?? 0) * 100,
      high: (last.high ?? last.value ?? 0) * 100,
    };
  }, [survivalForecast]);
  const genderDist = useMemo(() => lastBreakdown(data?.tsGender ?? null, "gender") ?? null, [data]);
  const genderPct = useMemo(() => {
    const f = genderDist?.["여성"] ?? 0;
    const m = genderDist?.["남성"] ?? 0;
    const tot = f + m;
    if (tot <= 0) return null;
    return { female: Math.round((f / tot) * 100), male: Math.round((m / tot) * 100) };
  }, [genderDist]);

  // 임대료 대표값 + 층별 막대.
  // avg_rent_per_sqm은 천원/㎡ 단위(R-ONE 원본). RentCard는 원/㎡를 기대하므로 ×1000.
  const rentBars: RentBar[] = useMemo(() => {
    const rows = data?.rent?.rent_stats ?? [];
    return rows.map((r) => ({
      label: r.floor_type ?? "—",
      value: r.avg_rent_per_sqm == null ? null : r.avg_rent_per_sqm * 1000,
    }));
  }, [data]);
  // 대표 임대료 = "집합상가 기준" 같은 특정 상가유형 하나가 아니라, 이 상권에 있는
  // 모든 상가유형(소규모/중대형/집합)의 ㎡당 임대료를 평균한 값.
  const rentAvgPerSqm = useMemo<number | null>(() => {
    const vals = (data?.rent?.rent_stats ?? [])
      .map((r) => r.avg_rent_per_sqm)
      .filter((v): v is number => v != null);
    if (vals.length === 0) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }, [data]);

  // 임대료 예측 차트 데이터. history는 rentBars의 최신 분기 실적 1점(대표 유형=중대형 기준 앵커),
  // forecast는 rent-forecast 응답(천원/㎡ → ×1000 원/㎡, rentBars와 동일 변환).
  const rentForecastHistory = useMemo<TimeseriesPoint[]>(() => {
    const anchorQuarter = data?.rent?.year_quarter ?? null;
    const bar = rentBars.find((b) => b.label === RENT_FORECAST_FLOOR_TYPE);
    return anchorQuarter != null && bar?.value != null ? [{ year_quarter: anchorQuarter, value: bar.value }] : [];
  }, [rentBars, data?.rent?.year_quarter]);
  const rentForecastSeries = useMemo<TimeseriesPoint[]>(() => {
    const fc = rentForecastQuery.data?.forecast ?? [];
    return fc.map((p) => ({
      year_quarter: p.year_quarter,
      value: p.avg_rent_per_sqm == null ? null : p.avg_rent_per_sqm * 1000,
      low: p.low == null ? null : p.low * 1000,
      high: p.high == null ? null : p.high * 1000,
      confidence: p.confidence,
    }));
  }, [rentForecastQuery.data]);
  const rentForecastFallbackNote =
    !rentForecastQuery.isPending && rentForecastSeries.length === 0 ? "임대료 예측 데이터가 아직 없습니다." : null;

  // AtmosphereSimulation용: 낮/밤 우위, 매출 비중, 시간대별 유동인구.
  const simDayDominant = useMemo<boolean | null>(() => {
    const sb = data?.salesBands;
    if (sb == null || sb.daytime_pct == null || sb.nighttime_pct == null) return null;
    return sb.daytime_pct >= sb.nighttime_pct;
  }, [data]);

  const simDaySalesPct = useMemo<number | null>(() => {
    const sb = data?.salesBands;
    if (simDayDominant === null || sb == null) return null;
    return simDayDominant ? (sb.daytime_pct ?? null) : (sb.nighttime_pct ?? null);
  }, [data, simDayDominant]);

  const simFootTraffic = useMemo<number | null>(() => {
    const byTime = data?.heatmap?.by_time ?? [];
    if (simDayDominant === null || byTime.length === 0) return d?.avg_population ?? null;
    const daySlots = new Set(["06~11", "11~14", "14~17"]);
    const nightSlots = new Set(["17~21", "21~24", "00~06"]);
    const targetSlots = simDayDominant ? daySlots : nightSlots;
    const matched = byTime.filter((s) => targetSlots.has(s.slot) && s.avg_population != null);
    if (matched.length === 0) return d?.avg_population ?? null;
    const avg = matched.reduce((sum, s) => sum + (s.avg_population ?? 0), 0) / matched.length;
    return avg;
  }, [data, simDayDominant, d]);


  // 상권 종합 점수의 유동인구 pill: commercial_district.avg_population 컬럼은 인제스천이
  // 채워주지 않는 값이라(구조적으로 갱신 안 됨) 대신 heatmap by_day 슬롯 합계를 쓴다.
  // by_day는 population_timeseries dimension='total'과 같은 분기 누적 총량의 요일별
  // partition이라 합산하면 그 분기 총 유동인구와 같다(히트맵이 쓰는 것과 동일 소스).
  const totalPopulationFromHeatmap = useMemo<number | null>(() => {
    const byDay = data?.heatmap?.by_day ?? [];
    if (byDay.length === 0) return null;
    return byDay.reduce((sum, s) => sum + (s.avg_population ?? 0), 0);
  }, [data]);

  // 유동인구 피크 시간대: heatmap by_time 중 최댓값 슬롯("17~21" → "17~21시").
  const peakLabel = useMemo<string | null>(() => {
    const byTime = data?.heatmap?.by_time ?? [];
    let bestSlot: string | null = null;
    let bestVal = 0;
    byTime.forEach((s) => {
      const v = s.avg_population ?? 0;
      if (v > bestVal) {
        bestVal = v;
        bestSlot = s.slot;
      }
    });
    return bestSlot != null ? `${bestSlot}시` : null;
  }, [data]);

  // 유동인구 피크 요일: heatmap by_day 중 최댓값 슬롯("금" → "금요일").
  const peakDayLabel = useMemo<string | null>(() => {
    const byDay = data?.heatmap?.by_day ?? [];
    let bestSlot: string | null = null;
    let bestVal = 0;
    byDay.forEach((s) => {
      const v = s.avg_population ?? 0;
      if (v > bestVal) {
        bestVal = v;
        bestSlot = s.slot;
      }
    });
    return bestSlot != null ? `${bestSlot}요일` : null;
  }, [data]);

  // 종합점수 순위(백엔드 제공, 상권 고유값 — 업종 선택과 무관). scope에 맞춰 라벨 접두어를 붙인다.
  const rankLabel = useMemo<string | null>(() => {
    const r = stats?.score_rank;
    if (r == null) return null;
    const prefix =
      stats?.rank_scope === "gu" ? (d?.gu_name ?? "자치구")
      : stats?.rank_scope === "type" ? (d?.type_name ?? "동일 유형")
      : "서울";
    return `${prefix} ${r.toLocaleString()}위`;
  }, [stats, d]);

  const region = d ? [d.gu_name, d.dong_name].filter(Boolean).join(" ") || null : null;

  // ── 상태 렌더 ───────────────────────────────────────────
  if (loading) {
    return (
      <div className={styles.page}>
        <TopSearchBar
          query={query}
          onQueryChange={setQuery}
          searchFocused={searchFocused}
          onFocus={() => setSearchFocused(true)}
          onKeyDown={handleSearchKeyDown}
          searchBarRef={searchBarRef}
          searchOptions={searchOptions}
          onPickSearch={handlePickSearch}
        />
        <Header name={null} region={null} typeName={null} />
        <div className={styles.skeletonWrap}>
          <div className={styles.skeleton} />
          <div className={styles.skeleton} />
          <div className={styles.skeleton} />
        </div>
      </div>
    );
  }

  if (error || !data || !d) {
    return (
      <div className={styles.page}>
        <TopSearchBar
          query={query}
          onQueryChange={setQuery}
          searchFocused={searchFocused}
          onFocus={() => setSearchFocused(true)}
          onKeyDown={handleSearchKeyDown}
          searchBarRef={searchBarRef}
          searchOptions={searchOptions}
          onPickSearch={handlePickSearch}
        />
        <Header name={null} region={null} typeName={null} />
        <div className={styles.empty}>상권 데이터를 불러오는 데 실패했어요. 새로고침하거나 다른 상권을 선택해보세요.</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <TopSearchBar
        query={query}
        onQueryChange={setQuery}
        searchFocused={searchFocused}
        onFocus={() => setSearchFocused(true)}
        onKeyDown={handleSearchKeyDown}
        searchBarRef={searchBarRef}
        searchOptions={searchOptions}
        onPickSearch={handlePickSearch}
      />
      <Header name={d.district_name} region={region} typeName={d.type_name} districtId={d.id} />

      {/* 상단 2열: 생존율 예측 + 종합점수(+시뮬레이션 진입) */}
      <section className={styles.topGrid}>
        <SurvivalCard
          current={survivalStartPct}
          forecast={forecastNextPct}
          delta={forecastDelta}
          points={forecastPoints}
          history={survivalHistory}
          forecastSeries={survivalForecast}
          onScenarioClick={setSim}
          totalBusiness={activeStats?.total_business ?? null}
          closureRate={activeStats?.closure_rate ?? null}
          categoryOptions={categoryOptions}
          selectedCategory={selCategory}
          onCategoryChange={setSelCategory}
          fallbackNote={fallbackNote}
        />

        <div className={styles.topGridLeft}>
          <ScoreCard
            score={activeStats?.district_score ?? null}
            survivalRate={activeStats?.survival_rate ?? null}
            closureRate={activeStats?.closure_rate ?? null}
            avgPopulation={totalPopulationFromHeatmap ?? d.avg_population}
            rankLabel={rankLabel}
          />
          <ScenarioSimBox onScenarioClick={setSim} />
        </div>
      </section>

      {/* 유동인구 */}
      <section className={styles.section}>
        <SectionTitle title="유동인구" subtitle="누가, 언제 이 상권에 오는가" />
        <div className={styles.popTopGrid}>
          <div className={styles.popTopRight}>
            <PopulationRhythmCard
              peakLabel={peakLabel}
              peakDayLabel={peakDayLabel}
              dayPct={data.popRatios?.daytime_pct ?? null}
              nightPct={data.popRatios?.nighttime_pct ?? null}
            />
            <ForeignCard
              pct={data.foreign?.foreigner_pct ?? null}
              count={data.foreign?.foreigner_count ?? null}
              total={data.foreign?.total_count ?? null}
            />
          </div>
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <div>
                <h3 className={styles.cardTitle}>유동인구 시간·요일 패턴</h3>
                <p className={styles.cardSub}>시간대 × 요일 평균 유동인구</p>
              </div>
              {data.heatmap && data.heatmap.by_time.length > 0 && data.heatmap.by_day.length > 0 && (
                <button
                  type="button"
                  className={styles.expandBtn}
                  onClick={() => setModal("heatmap")}
                  aria-label="유동인구 확대"
                >
                  ⤢
                </button>
              )}
            </div>
            {data.heatmap ? (
              <PopulationHeatmap byTime={data.heatmap.by_time} byDay={data.heatmap.by_day} showValues />
            ) : (
              <div className={styles.empty}>이 상권의 유동인구 기록이 아직 없습니다.</div>
            )}
          </div>
        </div>
      </section>

      {/* 매출·소비 */}
      <section className={styles.section}>
        <SectionTitle title="매출·소비" subtitle="고객은 언제, 얼마나 지갑을 여는가" />
        <div className={styles.salesMainGrid}>
          <div className={styles.salesLeftCol}>
            <SalesForecastCard
              history={salesHistory}
              forecast={salesForecastSeries}
              categoryLabel={salesCategoryLabel}
              fallbackNote={salesFallbackNote}
            />
            <div className={styles.salesLeftBottomRow}>
              <WeekendCard days={data.heatmap?.by_day ?? null} />
              <AgeGenderCard ageDist={ageDist} genderPct={genderPct} />
            </div>
          </div>
          <div className={styles.salesRightCol}>
            <PerCapitaCard wonValue={data.perCapita?.per_capita_sales ?? null} />
            <DayNightCard
              dayPct={data.salesBands?.daytime_pct ?? null}
              nightPct={data.salesBands?.nighttime_pct ?? null}
              bands={data.salesBands?.bands ?? null}
            />
          </div>
        </div>
      </section>

      {/* 비용·리스크 */}
      <section className={styles.section}>
        <SectionTitle title="비용·리스크" subtitle="창업 전 반드시 확인할 비용과 신호" />
        <div className={styles.duoGrid}>
          <RentCard perSqm={rentAvgPerSqm != null ? rentAvgPerSqm * 1000 : null} />
          <RentForecastCard
            history={rentForecastHistory}
            forecast={rentForecastSeries}
            floorTypeLabel={`${RENT_FORECAST_FLOOR_TYPE} 상가`}
            fallbackNote={rentForecastFallbackNote}
          />
        </div>
      </section>

      {/* 확대 모달: 유동인구 히트맵 */}
      {modal === "heatmap" && data.heatmap && (
        <ExpandModal
          title="유동인구 시간·요일 패턴"
          subtitle="시간대 × 요일 평균 유동인구 상세"
          onClose={() => setModal(null)}
        >
          <PopulationHeatmap byTime={data.heatmap.by_time} byDay={data.heatmap.by_day} showValues wide />
        </ExpandModal>
      )}

      {/* 상권 분위기 시뮬레이션: 생존율 예측 시나리오 선 클릭 시 */}
      {sim && (
        <Suspense fallback={<PageLoader />}>
          <AtmosphereSimulation
            scenario={sim}
            ageDistribution={ageSlices}
            survivalPct={survivalScenarioPct ? survivalScenarioPct[sim] : null}
            footTraffic={simFootTraffic}
            dayDominant={simDayDominant}
            daySalesPct={simDaySalesPct}
            foreignerPct={data.foreign?.foreigner_pct ?? null}
            startQuarter={survivalForecast[0]?.year_quarter ?? null}
            onClose={() => setSim(null)}
          />
        </Suspense>
      )}
    </div>
  );
}

/** 상단 검색 바 — 지역 분석(지도) 페이지와 동일한 스타일. 검색해서 다른 상권 상세로 이동. */
function TopSearchBar({
  query,
  onQueryChange,
  searchFocused,
  onFocus,
  onKeyDown,
  searchBarRef,
  searchOptions,
  onPickSearch,
}: {
  query: string;
  onQueryChange: (v: string) => void;
  searchFocused: boolean;
  onFocus: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  searchBarRef: React.RefObject<HTMLDivElement | null>;
  searchOptions: DistrictSearchResult[];
  onPickSearch: (result: DistrictSearchResult) => void;
}) {
  return (
    <div className={styles.topRow}>
      <Link to="/" className={styles.backToMapBtn} aria-label="지역 분석으로 돌아가기">
        ← 지역 분석으로 돌아가기
      </Link>
      <div className={styles.searchBar} style={{ position: "relative" }} ref={searchBarRef}>
        <span className={styles.searchIcon} aria-hidden>
          ⌕
        </span>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="지역·상권·업종 검색…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onFocus={onFocus}
          onKeyDown={onKeyDown}
        />
        {searchFocused && query.trim() && searchOptions.length > 0 && (
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
            {searchOptions.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => onPickSearch(o)}
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
  );
}

function Header({
  name,
  region,
  typeName,
  districtId,
}: {
  name: string | null;
  region: string | null;
  typeName: string | null;
  districtId?: number;
}) {
  const { isFavorite, toggle, pending } = useFavoriteDistrict();
  return (
    <div className={styles.header}>
      <div>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{name ?? "상권 프로필"}</h1>
          {districtId != null && (
            <FavoriteStar active={isFavorite(districtId)} disabled={pending} onToggle={() => toggle(districtId)} />
          )}
        </div>
        <p className={styles.subtitle}>
          {[region, typeName].filter(Boolean).join(" · ") || "상권 종합 리포트"}
        </p>
      </div>
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className={styles.sectionTitle}>
      <span className={styles.accentBar} />
      <div>
        <h2 className={styles.sectionHeading}>{title}</h2>
        {subtitle && <p className={styles.sectionSub}>{subtitle}</p>}
      </div>
    </div>
  );
}
