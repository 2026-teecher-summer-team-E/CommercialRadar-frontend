import { useQuery } from "@tanstack/react-query";
import { commercialApi } from "../services/commercialApi";
import { meApi } from "../services/meApi";
import { reportsApi } from "../services/reportsApi";
import { interestApi } from "../services/interestApi";
import type { DistrictCompareItem, InterestDistrict } from "../types";

type QP = Record<string, string | number | undefined>;

/**
 * queryKey 를 한 곳에서 관리한다.
 * 캐시 무효화(invalidateQueries)나 직접 갱신(setQueryData) 시 반드시 이 키를 사용할 것.
 */
export const queryKeys = {
  dashboard: (id: number) => ["dashboard", id] as const,
  compareDistricts: (ids: number[]) => ["compare-districts", ids] as const,
  ranking: (params?: QP) => ["district-ranking", params ?? null] as const,
  searchTrendRanking: (params?: QP) => ["search-trend-ranking", params ?? null] as const,
  compareQuarters: (ids: number[]) => ["compare-quarters", ids] as const,
  compareCategories: (ids: number[], quarter: string) =>
    ["compare-categories", ids, quarter] as const,
  comparePage: (ids: number[], quarter: string, category: string, rankingDistrictId?: number | null) =>
    ["compare-page", ids, quarter, category, rankingDistrictId ?? null] as const,
  timeSeries: (id: number | string, params?: QP) => ["time-series", id, params ?? null] as const,
  simDayNight: (ids: Array<number | null>) => ["compare-sim-daynight", ids] as const,
  belts: ["belts"] as const,
  beltMomentum: (slug: string) => ["belt-momentum", slug] as const,
  beltGeojson: (guNames: string[]) => ["belt-geojson", guNames] as const,
  categoryRanking: (id: number | string, params?: QP) =>
    ["category-ranking", id, params ?? null] as const,
  districtSearch: (keyword: string) => ["district-search", keyword] as const,
  affordable: (budget: number, area: number, floor: string, region?: string) =>
    ["affordable", budget, area, floor, region ?? null] as const,
  me: ["me"] as const,
  myStats: ["me", "stats"] as const,
  myReports: (params: { page: number; limit: number }) => ["me", "reports", params] as const,
  interests: ["interest-districts"] as const,
  favorites: ["favorite-districts"] as const,
  geo: ["district-geo"] as const,
  geojson: ["district-geojson"] as const,
  mapSummary: (id: number) => ["map-summary", id] as const,
};

/**
 * compare API(한 번에 2~5개 id 허용)에 맞춰 id 목록을 청크로 나눈다.
 * 마지막에 1개만 남으면 앞 청크의 마지막 id를 겹쳐 2개로 만들고(결과는 Map 으로 dedup 되어 무해),
 * 전체가 1개뿐이면 임의의 동반 id 를 붙여 최소 2개를 만든다.
 */
export function buildCompareChunks(ids: number[]): number[][] {
  if (ids.length === 0) return [];
  if (ids.length === 1) return [[ids[0], ids[0] === 1 ? 2 : 1]];
  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += 5) {
    const chunk = ids.slice(i, i + 5);
    if (chunk.length === 1) chunk.unshift(ids[i - 1]); // 마지막 1개 → 앞 id 겹쳐 2개
    chunks.push(chunk);
  }
  return chunks;
}

/** 여러 상권을 compare API 청크 호출로 병합 조회(랭킹 리더보드용). */
export function useCompareDistricts(ids: number[]) {
  return useQuery({
    queryKey: queryKeys.compareDistricts(ids),
    queryFn: async () => {
      const resArr = await Promise.all(buildCompareChunks(ids).map((c) => commercialApi.compare(c)));
      const merged = new Map<number, DistrictCompareItem>();
      resArr.forEach((res) => res.data.districts.forEach((d) => merged.set(d.id, d)));
      return [...merged.values()];
    },
  });
}

/** 상권 종합 랭킹(scope/sort/limit). 랭킹 페이지 리더보드용. */
export function useDistrictRanking(
  params?: {
    scope?: "seoul" | "gu" | "type";
    gu_name?: string;
    type_name?: string;
    sort?: "score" | "survival" | "population";
    limit?: number;
    offset?: number;
  },
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.ranking(params as QP | undefined),
    queryFn: () => commercialApi.ranking(params).then((r) => r.data),
    enabled: options?.enabled,
  });
}

/** 업종 검색 관심도 변화율 랭킹(트렌드 업종). 랜딩 트렌드 패널 등에서 사용. */
export function useSearchTrendRanking(params?: QP) {
  return useQuery({
    queryKey: queryKeys.searchTrendRanking(params),
    queryFn: () => commercialApi.searchTrendRanking(params).then((r) => r.data),
  });
}

/** 상권 분기 시계열. params 는 queryKey 에 포함되어 조합별로 캐시된다. */
export function useTimeSeries(id: number | string, params?: QP) {
  return useQuery({
    queryKey: queryKeys.timeSeries(id, params),
    queryFn: async () => (await commercialApi.timeSeries(id, params)).data,
  });
}

/** 유명 상권 벨트(축) 목록. 벨트 카드 리스트 / 벨트 간 비교용. */
export function useBelts() {
  return useQuery({
    queryKey: queryKeys.belts,
    queryFn: async () => (await commercialApi.listBelts()).data,
    staleTime: 10 * 60 * 1000,
  });
}

/** 벨트 성장 모멘텀(멤버 랭킹 + 뜨는/지는 + 인사이트). slug 가 비면 요청하지 않는다. */
export function useBeltMomentum(slug: string | null) {
  return useQuery({
    queryKey: queryKeys.beltMomentum(slug ?? ""),
    enabled: !!slug,
    queryFn: async () => (await commercialApi.beltMomentum(slug as string)).data,
    staleTime: 10 * 60 * 1000,
  });
}

/** 상권 업종별 추천 순위. */
export function useCategoryRanking(id: number | string, params?: QP) {
  return useQuery({
    queryKey: queryKeys.categoryRanking(id, params),
    queryFn: async () => (await commercialApi.categoryRanking(id, params)).data,
  });
}

/** 상권 검색. keyword 가 비었거나 enabled=false 면 요청하지 않는다. */
export function useDistrictSearch(keyword: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.districtSearch(keyword),
    enabled: enabled && keyword.length > 0,
    queryFn: async () => (await commercialApi.searchDistricts(keyword)).data,
  });
}

/** 월 임대료 예산으로 창업 가능한 상권 리스트. budget 이 유효할 때만 요청. */
export function useAffordableDistricts(
  params: { monthly_budget: number; area_sqm: number; floor_type: string; region?: string; limit?: number },
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.affordable(
      params.monthly_budget,
      params.area_sqm,
      params.floor_type,
      params.region,
    ),
    enabled: enabled && params.monthly_budget > 0 && params.area_sqm > 0,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => (await commercialApi.affordableDistricts(params)).data,
  });
}

/** 현재 로그인 유저. */
export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: async () => (await meApi.me()).data,
  });
}

/** 마이페이지 요약 카운트. */
export function useMyStats() {
  return useQuery({
    queryKey: queryKeys.myStats,
    queryFn: async () => (await meApi.stats()).data,
  });
}

/** 저장된 리포트 목록. */
export function useMyReports(params: { page: number; limit: number }) {
  return useQuery({
    queryKey: queryKeys.myReports(params),
    queryFn: async () => (await reportsApi.list(params)).data,
  });
}

/**
 * 관심 상권 목록 + compare API 로 상권 이름 채우기.
 * enabled=false 로 두면 탭 진입 전까지 요청하지 않는다(기존 lazy fetch 유지).
 */
export function useInterestDistricts(enabled = true) {
  return useQuery({
    queryKey: queryKeys.interests,
    enabled,
    queryFn: async (): Promise<InterestDistrict[]> => {
      const list = (await interestApi.list()).data ?? [];
      if (list.length === 0) return [];
      const ids = [...new Set(list.map((it) => it.commercial_district_id))];
      const nameById = new Map<number, string>();
      // allSettled: 한 청크가 실패해도 나머지 이름은 채운다.
      const resArr = await Promise.allSettled(
        buildCompareChunks(ids).map((c) => commercialApi.compare(c)),
      );
      resArr.forEach((res) => {
        if (res.status === "fulfilled")
          res.value.data.districts.forEach((d) => nameById.set(d.id, d.district_name));
      });
      return list.map((it) => ({
        ...it,
        district_name: nameById.get(it.commercial_district_id) ?? it.district_name,
      }));
    },
  });
}
