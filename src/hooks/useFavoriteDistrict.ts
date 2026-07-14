import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { interestApi } from "../services/interestApi";
import type { InterestDistrict } from "../types";
import { queryKeys } from "./queries";

const EMPTY_ITEMS: InterestDistrict[] = [];

/** 관심 상권(즐겨찾기) 등록 여부 조회 + 토글. 목록은 전역 캐시로 공유되어 페이지 이동 시 재요청하지 않는다. */
export function useFavoriteDistrict() {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);

  const query = useQuery({
    queryKey: queryKeys.favorites,
    queryFn: async () => (await interestApi.list()).data ?? [],
  });
  const items = query.data ?? EMPTY_ITEMS;
  const loaded = query.isSuccess || query.isError;

  const findItem = useCallback(
    (districtId: number) => items.find((it) => it.commercial_district_id === districtId) ?? null,
    [items],
  );

  const isFavorite = useCallback((districtId: number) => findItem(districtId) != null, [findItem]);

  const toggle = useCallback(
    async (districtId: number) => {
      const existing = findItem(districtId);
      setPending(true);
      try {
        if (existing) {
          await interestApi.remove(existing.id);
          queryClient.setQueryData<InterestDistrict[]>(queryKeys.favorites, (prev) =>
            prev?.filter((it) => it.id !== existing.id),
          );
        } else {
          const res = await interestApi.create({ commercial_district_id: districtId });
          queryClient.setQueryData<InterestDistrict[]>(queryKeys.favorites, (prev) => [
            ...(prev ?? []),
            res.data,
          ]);
        }
        // 마이페이지의 관심 상권 목록(이름 채워진 버전)과 요약 카운트도 다음 조회 때 갱신되도록 무효화.
        queryClient.invalidateQueries({ queryKey: queryKeys.interests });
        queryClient.invalidateQueries({ queryKey: queryKeys.myStats });
      } finally {
        setPending(false);
      }
    },
    [findItem, queryClient],
  );

  return { loaded, pending, isFavorite, toggle };
}
