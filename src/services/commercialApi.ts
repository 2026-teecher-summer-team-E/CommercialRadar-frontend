import { apiClient } from "../lib/apiClient";
import type {
  DistrictCompareResponse,
  DistrictRankingItem,
  DistrictTimeSeriesResponse,
  CategoryRankingResponse,
  CityCategoryRankingResponse,
  CategorySearchTrendRankingResponse,
  PopularCategoriesResponse,
  PopularityHistoryResponse,
  RelatedCategoriesResponse,
  DistrictCategoryStatsResponse,
  RadarResponse,
  PopulationHeatmapResponse,
  SalesTimeBandsResponse,
  BeltSummary,
  BeltMomentum,
  DistrictGeo,
  CommercialDistrictSearchResult,
  AffordableResponse,
} from "../types";

type QP = Record<string, string | number | undefined>;

export const commercialApi = {
  listDistricts: () => apiClient.get("/api/commercial-districts"),
  searchDistricts: (query: string) =>
    apiClient.get<CommercialDistrictSearchResult[]>("/api/commercial-districts/search", {
      params: { q: query },
    }),
  getDistrict: (id: string | number) => apiClient.get(`/api/commercial-districts/${id}`),

  /** 다중 상권 비교. district_ids 는 콤마 구분. */
  compare: (ids: Array<number | string>, params?: { year_quarter?: string; category_name?: string }) =>
    apiClient.get<DistrictCompareResponse>("/api/commercial-districts/compare", {
      params: { district_ids: ids.join(","), ...params } as QP,
    }),

  timeSeries: (id: number | string, params?: QP) =>
    apiClient.get<DistrictTimeSeriesResponse>(`/api/commercial-districts/${id}/time-series`, { params }),

  categoryRanking: (id: number | string, params?: QP) =>
    apiClient.get<CategoryRankingResponse>(`/api/commercial-districts/${id}/category-ranking`, { params }),

  /** 특정 상권에 국한하지 않는 전체 상권 집계 업종 랭킹. */
  cityCategoryRanking: (params?: QP) =>
    apiClient.get<CityCategoryRankingResponse>("/api/categories/ranking", { params }),

  /** 업종명을 네이버 데이터랩 검색어로 조회한 검색 관심도 변화율 랭킹. */
  searchTrendRanking: (params?: QP) =>
    apiClient.get<CategorySearchTrendRankingResponse>("/api/categories/search-trend-ranking", { params }),

  /** 앵커 업종 대비 재정규화된 검색 상대지수 기준, 가장 많이 검색된 업종. */
  popularCategories: (params?: QP) =>
    apiClient.get<PopularCategoriesResponse>("/api/categories/popular", { params }),

  /** 현재 인기 업종 상위 N개의 월별 popularity_index 추이(바 차트 레이스용). */
  popularityHistory: (params?: QP) =>
    apiClient.get<PopularityHistoryResponse>("/api/categories/popular/history", { params }),

  /** 기준 업종과 검색 추이(피어슨 상관계수)가 비슷한 업종. */
  relatedCategories: (categoryName: string, params?: QP) =>
    apiClient.get<RelatedCategoriesResponse>(
      `/api/categories/${encodeURIComponent(categoryName)}/related`,
      { params },
    ),

  /** 상권 종합 랭킹. scope=seoul|gu|type, sort=score|survival|population. 랭킹 페이지용.
   * category_name을 주면 전 업종 평균 대신 그 업종 점수로 재정렬(해당 업종 없는 상권은 제외). */
  ranking: (params?: {
    scope?: "seoul" | "gu" | "type";
    gu_name?: string;
    type_name?: string;
    category_name?: string;
    sort?: "score" | "survival" | "population";
    limit?: number;
    offset?: number;
  }) =>
    apiClient.get<DistrictRankingItem[]>("/api/commercial-districts/ranking", {
      params: params as QP,
    }),

  /** 상권 1개 + 특정 업종 하나의 생존율/폐업률/매출/점수. 업종 필터 선택 시 좌측 패널 갱신용. */
  categoryStats: (id: number | string, params?: { year_quarter?: string; category_name?: string }) =>
    apiClient.get<DistrictCategoryStatsResponse>(`/api/commercial-districts/${id}/category-stats`, {
      params: params as QP,
    }),

  /** [신규] 5축 정규화 레이더 */
  radar: (id: number | string, params?: QP) =>
    apiClient.get<RadarResponse>(`/api/commercial-districts/${id}/radar`, { params }),

  /** [신규] 유동인구 히트맵(시간/요일 주변분포) */
  heatmap: (id: number | string, params?: QP) =>
    apiClient.get<PopulationHeatmapResponse>(`/api/commercial-districts/${id}/population-heatmap`, { params }),

  /** [신규] 시간대별 매출 낮/밤 비중(낮=06~17, 밤=17~06). 낮상권/밤상권 판정용. */
  salesTimeBands: (id: number | string, params?: QP) =>
    apiClient.get<SalesTimeBandsResponse>(`/api/commercial-districts/${id}/sales-time-bands`, { params }),

  /** [신규] 유명 상권 벨트(축) 목록 + 요약 성장률. 벨트 간 생애주기 비교용. */
  listBelts: () => apiClient.get<BeltSummary[]>("/api/belts"),

  /** [신규] 벨트 성장 모멘텀(멤버별 성장 랭킹 + 뜨는/지는 + 인사이트). slug 없으면 404. */
  beltMomentum: (slug: string) =>
    apiClient.get<BeltMomentum>(`/api/belts/${encodeURIComponent(slug)}/momentum`),

  /** [신규] 전 상권 중심좌표(Leaflet 마커용). gu_name 으로 자치구 필터. */
  geo: (params?: { gu_name?: string }) =>
    apiClient.get<DistrictGeo[]>("/api/commercial-districts/geo", { params }),

  /** [신규] 상권 경계 폴리곤 GeoJSON(Leaflet 구역 표시용). */
  geojson: (params?: { gu_name?: string }) =>
    apiClient.get<GeoJSON.FeatureCollection>("/api/commercial-districts/geojson", { params }),

  /** [신규] 월 임대료 예산으로 창업 가능한 상권 리스트(추정 월 임대료 오름차순). 임대료 보유 상권(~14%)만. */
  affordableDistricts: (params: {
    monthly_budget: number;
    area_sqm?: number;
    floor_type?: string;
    region?: string;
    category_name?: string;
    limit?: number;
  }) => apiClient.get<AffordableResponse>("/api/simulate/affordable", { params: params as QP }),
};
