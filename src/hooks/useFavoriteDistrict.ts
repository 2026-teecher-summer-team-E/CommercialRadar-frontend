import { useCallback, useEffect, useState } from "react";
import { interestApi } from "../services/interestApi";
import type { InterestDistrict } from "../types";

/** 관심 상권(즐겨찾기) 등록 여부 조회 + 토글. 페이지 마운트 시 전체 목록을 한 번 불러온다. */
export function useFavoriteDistrict() {
  const [items, setItems] = useState<InterestDistrict[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let alive = true;
    interestApi
      .list()
      .then((r) => {
        if (alive) setItems(r.data ?? []);
      })
      .catch(() => {
        if (alive) setItems([]);
      })
      .finally(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

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
          setItems((prev) => prev.filter((it) => it.id !== existing.id));
        } else {
          const res = await interestApi.create({ commercial_district_id: districtId });
          setItems((prev) => [...prev, res.data]);
        }
      } finally {
        setPending(false);
      }
    },
    [findItem],
  );

  return { loaded, pending, isFavorite, toggle };
}
