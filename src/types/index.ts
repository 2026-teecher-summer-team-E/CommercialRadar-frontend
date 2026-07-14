// ── 기존 ─────────────────────────────────────────────
export interface CommercialDistrict {
  id: number;
  district_name: string;
  type_name: string | null;
  gu_name: string | null;
  dong_name: string | null;
  avg_population: number | null;
  area_name: string | null;
}

export interface CommercialDistrictSearchResult {
  id: number;
  district_name: string;
  type_name: string | null;
  gu_name: string | null;
  dong_name: string | null;
}

export interface BusinessCategory {
  id: number;
  commercial_district_id: number;
  category_name: string | null;
  year_quarter: string;
  closure_rate: number | null;
  survival_rate: number | null;
  open_rate: number | null;
  total_business: number | null;
  total_sales: number | null;
}

export type PredictionType = "survival" | "population" | "sales";

// ── 상권 비교 (GET /api/commercial-districts/compare) ──
export interface DistrictCompareItem {
  id: number;
  district_name: string;
  avg_population: number | null;
  survival_rate: number | null;
  closure_rate: number | null;
  district_score: number | null;
}
export interface DistrictCompareResponse {
  year_quarter: string | null;
  category_name: string | null;
  districts: DistrictCompareItem[];
}

// ── 상권 랭킹 (GET /api/commercial-districts/ranking) ──
export interface DistrictRankingItem {
  rank: number;
  rank_total: number | null;
  percentile: number | null;
  id: number;
  district_name: string;
  gu_name: string | null;
  type_name: string | null;
  district_score: number | null;
  survival_rate: number | null; // 0~100 (%). 원본 이상치 가능 → 표시 전 가드 필요.
  avg_population: number | null; // 분기 총 유동인구.
}

// ── 분기별 추이 (GET /api/commercial-districts/{id}/time-series) ──
export interface PopulationMetric {
  total: number | null;
  breakdown?: Record<string, Record<string, number>> | null;
}
export interface DistrictQuarterMetrics {
  year_quarter: string;
  survival_rate: number | null;
  closure_rate: number | null;
  open_rate: number | null;
  population: PopulationMetric | null;
  sales: number | null;
}
export interface DistrictTimeSeriesResponse {
  district_id: number;
  data: DistrictQuarterMetrics[];
}

// ── 업종 랭킹 (GET /api/commercial-districts/{id}/category-ranking) ──
export interface CategoryRankingItem {
  rank: number;
  category_name: string | null;
  district_score: number | null;
  survival_rate: number | null;
  total_business: number | null;
}
export interface CategoryRankingResponse {
  district_id: number;
  year_quarter: string | null;
  ranking: CategoryRankingItem[];
}

// ── 전체 상권 집계 업종 랭킹 (GET /api/categories/ranking) ──
export interface CityCategoryRankingResponse {
  year_quarter: string | null;
  ranking: CategoryRankingItem[];
}

// ── 업종 네이버 검색어 트렌드 랭킹 (GET /api/categories/search-trend-ranking) ──
export interface CategorySearchTrendItem {
  rank: number;
  category_name: string;
  trend_pct: number;
  latest_ratio: number;
  periods: number;
  business_trend_pct: number;
  qoq_business_change: number;
}
export interface CategorySearchTrendRankingResponse {
  period_from: string | null;
  period_to: string | null;
  ranking: CategorySearchTrendItem[];
}

// ── 많이 검색된 업종 (GET /api/categories/popular) ──
export interface PopularCategoryItem {
  rank: number;
  category_name: string;
  popularity_index: number;
  trend_pct: number | null;
  qoq_business_change: number | null;
}
export interface PopularCategoriesResponse {
  period: string | null;
  anchor: string;
  items: PopularCategoryItem[];
}

// ── 검색 추이가 비슷한 업종 (GET /api/categories/{category_name}/related) ──
export interface RelatedCategoryItem {
  category_name: string;
  correlation: number;
  trend_pct: number | null;
  qoq_business_change: number | null;
}
export interface RelatedCategoriesResponse {
  category_name: string;
  related: RelatedCategoryItem[];
}

// ── 생존율 예측 (GET /api/commercial-districts/{id}/survival-forecast) ──
export interface SurvivalForecastPoint {
  year_quarter: string;
  survival_rate: number | null; // 대표값 = 중앙값(P50), 0~1 비율
  low: number | null; // 비관 시나리오 P10 (없으면 대표값)
  high: number | null; // 낙관 시나리오 P90 (없으면 대표값)
  confidence: number | null;
}
export interface SurvivalForecastResponse {
  district_id: number;
  model: string;
  category_name: string | null;
  forecast: SurvivalForecastPoint[];
}

// ── 매출 예측 (GET /api/commercial-districts/{id}/sales-forecast) ──
export interface SalesForecastPoint {
  year_quarter: string;
  total_sales: number | null; // 분기 총매출(원)
  tx_count: number | null;
  low: number | null; // 비관 P10
  high: number | null; // 낙관 P90
  confidence: number | null;
}
export interface SalesForecastResponse {
  district_id: number;
  model: string | null;
  category_name: string | null;
  forecast: SalesForecastPoint[];
}

// ── 레이더 (GET /api/commercial-districts/{id}/radar) [신규] ──
export interface RadarAxis {
  key: string;
  label: string;
  value: number; // 0~100
}
export interface RadarResponse {
  district_id: number;
  year_quarter: string | null;
  axes: RadarAxis[];
}

// ── 유동인구 히트맵 (GET /api/commercial-districts/{id}/population-heatmap) [신규] ──
// 주의: 데이터는 2D 매트릭스가 아니라 시간대/요일 주변분포(marginal)다.
export interface HeatmapSlot {
  slot: string;
  avg_population: number | null;
}
export interface PopulationHeatmapResponse {
  district_id: number;
  by_time: HeatmapSlot[];
  by_day: HeatmapSlot[];
}

// ── 상권 좌표 (GET /api/commercial-districts/geo) [Leaflet 지도용] ──
export interface DistrictGeo {
  id: number;
  district_name: string;
  type_name: string | null;
  gu_name: string | null;
  lat: number;
  lng: number;
  population: number | null;
  district_score: number | null;
}

// ── 업종별 현황 (GET /api/commercial-districts/{id}/category-stats) ──
export interface CategoryStat {
  category_name: string;
  survival_rate: number | null;
  closure_rate: number | null;
  open_rate: number | null;
  total_business: number | null;
  total_sales: number | null;
  tx_count: number | null;
  district_score: number | null;
}

export interface DistrictCategoryStatsResponse {
  district_id: number;
  year_quarter: string | null;
  categories: CategoryStat[];
}

// ── 유저 (GET /api/users/me, /api/users/me/stats) [신규] ──
export interface UserMe {
  id: number;
  name: string;
  email: string | null;
  is_admin: boolean;
  is_company: boolean;
  created_at: string;
}
export interface UserStats {
  saved_reports: number;
  interest_districts: number;
  shared_reports: number;
}

// ── 리포트 (GET /api/reports) ──
export interface ReportListItem {
  id: number;
  title: string;
  district_name: string | null;
  category_name: string | null;
  memo: string | null;
  created_at: string;
}
export interface ReportListResponse {
  total: number;
  page: number;
  limit: number;
  reports: ReportListItem[];
}

// ── 관심 상권 (GET /api/interest-districts) ──
export interface InterestDistrict {
  id: number;
  commercial_district_id: number;
  district_name?: string | null;
  category_name?: string | null;
  memo?: string | null;
  created_at: string;
}

// ── 딥러닝(강남역 카페) 예측 데모 전용 타입 ──
export interface TimeseriesPoint {
  year_quarter: string;
  value: number | null;
  low?: number | null;
  mid?: number | null;
  high?: number | null;
  confidence?: number | null;
}
export interface TimeseriesResponse {
  district_id: number;
  category_name: string | null;
  metric: "sales" | "survival";
  unit: "won" | "ratio";
  history: TimeseriesPoint[];
  forecast: TimeseriesPoint[];
}
export interface AgeSlice {
  name: string;
  pct: number;
}
