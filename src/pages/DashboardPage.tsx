import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
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
import ScoreCard from "../components/dashboard/ScoreCard";
import SurvivalCard from "../components/dashboard/SurvivalCard";
import PopulationHeatmap from "../components/dashboard/PopulationHeatmap";
import AgeGenderCard from "../components/dashboard/AgeGenderCard";
import RentCard from "../components/dashboard/RentCard";
import type { RentBar } from "../components/dashboard/RentCard";
import BuzzGapCard from "../components/dashboard/BuzzGapCard";
import { DayNightCard, ForeignCard, PerCapitaCard, WeekendCard } from "../components/dashboard/StatCards";
import ExpandModal from "../components/dashboard/ExpandModal";
import { quarterShort } from "../components/dashboard/format";
import { useFavoriteDistrict } from "../hooks/useFavoriteDistrict";
import FavoriteStar from "../components/common/FavoriteStar";
import PageLoader from "../components/common/PageLoader";
import styles from "./DashboardPage.module.css";

// recharts + lottie가 들어있어 무거움 — 시나리오 클릭(모달) 시점에만 로드.
const AtmosphereSimulation = lazy(() => import("../components/charts/AtmosphereSimulation"));

/** getDistrict 응답(서비스가 제네릭 없이 any 반환) — 페이지 내부 로컬 타입. */
interface DistrictLatestStats {
  year_quarter: string | null;
  district_score: number | null;
  survival_rate: number | null;
  closure_rate: number | null;
  total_business: number | null;
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

/** 화제성 Gap 응답(전용 서비스 없음). */
interface BuzzGapItem {
  district_name: string;
  gu_name: string | null;
  buzz_index: number;
  foot_pctl: number;
  spend_pctl: number;
  visit_gap: number;
  spend_gap: number;
}
interface BuzzGapResponse {
  period: string | null;
  source: string;
  items: BuzzGapItem[];
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
  forecast: SurvivalForecastResponse | null;
  rent: RentResponse | null;
  buzz: BuzzGapResponse | null;
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

/** 백분위(0~100, 높을수록 상위) → 상위 % 표기값(작을수록 상위). */
function toTopPct(pctl: number | null | undefined): number | null {
  if (pctl == null) return null;
  return Math.max(1, 100 - Math.round(pctl));
}

export default function DashboardPage() {
  const { districtCode } = useParams();
  const id = useMemo<number | null>(() => {
    const n = Number(districtCode);
    return districtCode && Number.isFinite(n) && n > 0 ? n : null;
  }, [districtCode]);

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [modal, setModal] = useState<"forecast" | "heatmap" | null>(null);
  const [sim, setSim] = useState<"low" | "mid" | "high" | null>(null);

  useEffect(() => {
    if (id == null) {
      setError(true);
      setLoading(false);
      return;
    }

    let alive = true;
    setLoading(true);
    setError(false);

    Promise.allSettled([
      commercialApi.getDistrict(id),
      commercialApi.radar(id),
      commercialApi.heatmap(id),
      commercialApi.timeSeries(id, { metrics: "population", breakdown: "age" }),
      commercialApi.timeSeries(id, { metrics: "population", breakdown: "gender" }),
      mlApi.survivalForecast(id),
      apiClient.get<RentResponse>(`/api/commercial-districts/${id}/rent`),
      apiClient.get<BuzzGapResponse>("/api/buzz-gap"),
      apiClient.get<ForeignRatioResponse>(`/api/commercial-districts/${id}/foreign-ratio`),
      apiClient.get<PopulationRatiosResponse>(`/api/commercial-districts/${id}/population-ratios`),
      apiClient.get<SalesTimeBandsResponse>(`/api/commercial-districts/${id}/sales-time-bands`),
      apiClient.get<PerCapitaSalesResponse>(`/api/commercial-districts/${id}/per-capita-sales`),
    ])
      .then((results) => {
        if (!alive) return;
        const [
          districtR,
          radarR,
          heatmapR,
          tsAgeR,
          tsGenderR,
          forecastR,
          rentR,
          buzzR,
          foreignR,
          popRatiosR,
          salesBandsR,
          perCapitaR,
        ] = results;
        const district = pick<DistrictDetail>(districtR);
        if (!district) {
          setError(true);
          return;
        }
        setData({
          district,
          radar: pick<RadarResponse>(radarR),
          heatmap: pick<PopulationHeatmapResponse>(heatmapR),
          tsAge: pick<DistrictTimeSeriesResponse>(tsAgeR),
          tsGender: pick<DistrictTimeSeriesResponse>(tsGenderR),
          forecast: pick<SurvivalForecastResponse>(forecastR),
          rent: pick<RentResponse>(rentR),
          buzz: pick<BuzzGapResponse>(buzzR),
          foreign: pick<ForeignRatioResponse>(foreignR),
          popRatios: pick<PopulationRatiosResponse>(popRatiosR),
          salesBands: pick<SalesTimeBandsResponse>(salesBandsR),
          perCapita: pick<PerCapitaSalesResponse>(perCapitaR),
        });
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
  }, [id]);

  // ── 파생 값 ─────────────────────────────────────────────
  const d = data?.district ?? null;
  const stats = d?.latest_stats ?? null;

  // 생존율 예측 API는 survival_rate를 비율(0~1)로 반환하지만 latest_stats는 퍼센트(0~100)다.
  // 단위를 %로 통일한다(비율이면 ×100).
  const toPct = (v: number | null | undefined): number | null =>
    v == null ? null : v <= 1 ? v * 100 : v;

  const forecastPoints: ForecastPoint[] = useMemo(() => {
    const fc = data?.forecast?.forecast ?? [];
    const pts: ForecastPoint[] = [];
    if (stats?.survival_rate != null && stats.year_quarter) {
      pts.push({ label: quarterShort(stats.year_quarter), value: stats.survival_rate, forecast: false });
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
  }, [data, stats]);

  // GangnamForecastChart용 시계열(unit="ratio" → 0~1 스케일 필수).
  // latest_stats.survival_rate는 0~100 이므로 /100. forecast는 이미 0~1.
  // 누적 생존율: 창업 시점=100%, 분기별 생존율(0~1)을 복리로 곱해 점점 감소.
  // 낙관(high)·비관(low) 밴드도 각각 누적해 시간이 갈수록 벌어진다.
  const survivalCum = useMemo(() => {
    const fc = data?.forecast?.forecast ?? [];
    const anchorQ = stats?.year_quarter ?? null;
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
  }, [data, stats]);
  const survivalHistory = survivalCum.history;
  const survivalForecast = survivalCum.forecast;

  // 카드 헤로: 창업 시점 100% → 4분기 후 누적 생존율.
  const survivalStartPct = survivalHistory.length > 0 ? 100 : null;
  const forecastNextPct = survivalCum.finalPct;
  const forecastDelta =
    survivalStartPct != null && forecastNextPct != null
      ? Number((forecastNextPct - survivalStartPct).toFixed(1))
      : null;

  // 연령 분포(실데이터, dimension="age"). 성별 marginal 은 {남성:총,여성:총} 총량뿐이라
  // 연령×성별 세부는 DB 에 없다. 연령 막대는 성별 비율로 스케일해 토글을 표현한다.
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
  const { femaleDist, maleDist } = useMemo(() => {
    if (!ageDist) return { femaleDist: null, maleDist: null };
    const f = genderDist?.["여성"] ?? 0;
    const m = genderDist?.["남성"] ?? 0;
    const tot = f + m;
    const fr = tot > 0 ? f / tot : 0.5;
    const scale = (r: number) => Object.fromEntries(Object.entries(ageDist).map(([k, v]) => [k, v * r]));
    return { femaleDist: scale(fr), maleDist: scale(1 - fr) };
  }, [ageDist, genderDist]);

  // 임대료 대표값 + 층별 막대.
  // avg_rent_per_sqm은 천원/㎡ 단위(R-ONE 원본). RentCard는 원/㎡를 기대하므로 ×1000.
  const rentBars: RentBar[] = useMemo(() => {
    const rows = data?.rent?.rent_stats ?? [];
    return rows.map((r) => ({
      label: r.floor_type ?? "—",
      value: r.avg_rent_per_sqm == null ? null : r.avg_rent_per_sqm * 1000,
    }));
  }, [data]);
  const rentRep = useMemo<RentStat | null>(() => {
    const rows = data?.rent?.rent_stats ?? [];
    return rows.length > 0 ? rows[0] : null;
  }, [data]);

  // 화제성 Gap: 현재 상권명과 일치하는 항목.
  const buzzItem = useMemo<BuzzGapItem | null>(() => {
    const items = data?.buzz?.items ?? [];
    if (!d) return null;
    return items.find((it) => it.district_name === d.district_name) ?? null;
  }, [data, d]);

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

  // 유출/유입 진행바: 요일 주변분포 주중/주말 합으로 근사(실데이터 없으면 지표없음).
  const flow = useMemo<{ weekday: number; weekend: number } | null>(() => {
    const byDay = data?.heatmap?.by_day ?? [];
    if (byDay.length === 0) return null;
    const weekdayKeys = new Set(["월", "화", "수", "목", "금"]);
    let wk = 0;
    let we = 0;
    byDay.forEach((s) => {
      const v = s.avg_population ?? 0;
      if (weekdayKeys.has(s.slot)) wk += v;
      else we += v;
    });
    const total = wk + we || 1;
    const weekday = Math.round((wk / total) * 100);
    return { weekday, weekend: 100 - weekday };
  }, [data]);

  const region = d ? [d.gu_name, d.dong_name].filter(Boolean).join(" ") || null : null;
  const regionLine = d
    ? [d.gu_name, d.dong_name, d.district_name].filter(Boolean).join(" ") || null
    : null;

  // ── 상태 렌더 ───────────────────────────────────────────
  if (loading) {
    return (
      <div className={styles.page}>
        <PageNav />
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
        <PageNav />
        <Header name={null} region={null} typeName={null} />
        <div className={styles.empty}>상권 데이터를 불러오는 데 실패했어요. 새로고침하거나 다른 상권을 선택해보세요.</div>
      </div>
    );
  }

  // 점수 구성 배지: radar 5축 중 생존율·유동인구·매출 실측 정규화 점수(0~100). 없으면 지표없음.
  const radarValue = (key: string): number | null => {
    const ax = data?.radar?.axes?.find((a) => a.key === key);
    return ax?.value ?? null;
  };
  const scoreBadges = [
    { label: "생존율", value: radarValue("survival") },
    { label: "유동인구", value: radarValue("population") },
    { label: "매출", value: radarValue("sales") },
  ];

  return (
    <div className={styles.page}>
      <PageNav />
      <Header name={d.district_name} region={region} typeName={d.type_name} districtId={d.id} />

      {/* 상단 2열: 종합점수 + 생존율 예측 */}
      <section className={styles.topGrid}>
        <ScoreCard
          districtName={d.district_name}
          typeName={d.type_name}
          regionLine={regionLine}
          score={stats?.district_score ?? null}
          badges={scoreBadges}
          survivalRate={stats?.survival_rate ?? null}
          closureRate={stats?.closure_rate ?? null}
          avgPopulation={d.avg_population}
          weekdayPct={flow?.weekday ?? null}
          weekendPct={flow?.weekend ?? null}
        />

        <SurvivalCard
          current={survivalStartPct}
          forecast={forecastNextPct}
          delta={forecastDelta}
          points={forecastPoints}
          history={survivalHistory}
          forecastSeries={survivalForecast}
          onScenarioClick={setSim}
          totalBusiness={stats?.total_business ?? null}
          closureRate={stats?.closure_rate ?? null}
          onExpand={() => setModal("forecast")}
        />
      </section>

      {/* 유동인구 */}
      <section className={styles.section}>
        <SectionTitle title="유동인구" subtitle="누가, 언제 이 상권에 오는가" />
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
            <PopulationHeatmap byTime={data.heatmap.by_time} byDay={data.heatmap.by_day} />
          ) : (
            <div className={styles.empty}>이 상권의 유동인구 기록이 아직 없습니다.</div>
          )}
        </div>

        <div className={styles.trioGrid}>
          <AgeGenderCard ageFemale={femaleDist} ageMale={maleDist} />
          <DayNightCard
            dayPct={data.salesBands?.daytime_pct ?? null}
            nightPct={data.salesBands?.nighttime_pct ?? null}
            bands={data.salesBands?.bands ?? null}
          />
          <ForeignCard pct={data.foreign?.foreigner_pct ?? null} />
        </div>
      </section>

      {/* 매출·소비 */}
      <section className={styles.section}>
        <SectionTitle title="매출·소비" subtitle="고객은 얼마나, 어떻게 지갑을 여는가" />
        <div className={styles.duoGrid}>
          <PerCapitaCard wonValue={data.perCapita?.per_capita_sales ?? null} />
          <WeekendCard pct={data.popRatios?.weekend_pct ?? null} days={data.heatmap?.by_day ?? null} />
        </div>
      </section>

      {/* 비용·리스크 */}
      <section className={styles.section}>
        <SectionTitle title="비용·리스크" subtitle="창업 전 반드시 확인할 비용과 신호" />
        <div className={styles.duoGrid}>
          <RentCard
            perSqm={rentRep?.avg_rent_per_sqm != null ? rentRep.avg_rent_per_sqm * 1000 : null}
            floorLabel={rentRep?.floor_type ?? null}
            bars={rentBars}
          />
          <BuzzGapCard
            buzzTopPct={buzzItem ? Math.max(1, 100 - buzzItem.buzz_index) : null}
            footTopPct={toTopPct(buzzItem?.foot_pctl)}
            spendTopPct={toTopPct(buzzItem?.spend_pctl)}
            visitGap={buzzItem?.visit_gap ?? null}
            spendGap={buzzItem?.spend_gap ?? null}
          />
        </div>
      </section>

      {/* 확대 모달: 생존율 예측 */}
      {modal === "forecast" && (
        <ExpandModal
          title="생존율 예측"
          subtitle="ML 향후 4분기 전망"
          onClose={() => setModal(null)}
        >
          <div className={styles.modalChart}>
            <SurvivalCard
              current={survivalStartPct}
              forecast={forecastNextPct}
              delta={forecastDelta}
              points={forecastPoints}
              history={survivalHistory}
              forecastSeries={survivalForecast}
              onScenarioClick={setSim}
              totalBusiness={stats?.total_business ?? null}
              closureRate={stats?.closure_rate ?? null}
            />
          </div>
        </ExpandModal>
      )}

      {/* 확대 모달: 유동인구 히트맵 */}
      {modal === "heatmap" && data.heatmap && (
        <ExpandModal
          title="유동인구 시간·요일 패턴"
          subtitle="시간대 × 요일 평균 유동인구 상세"
          onClose={() => setModal(null)}
        >
          <PopulationHeatmap byTime={data.heatmap.by_time} byDay={data.heatmap.by_day} showValues />
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

/** 대시보드 상단 위치 표시줄: 어디서 왔고, 지금 어떤 페이지인지 보여준다. */
function PageNav() {
  return (
    <div className={styles.pageNav}>
      <Link to="/" className={styles.pageNavBack}>
        ← 지역 분석
      </Link>
      <span className={styles.pageNavDivider} />
      <span className={styles.pageNavActive}>상세 분석 보기</span>
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
