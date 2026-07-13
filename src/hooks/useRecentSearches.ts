import { useCallback, useState } from "react";

export interface RecentSearchItem {
  id: number;
  district_name: string;
  gu_name: string | null;
  dong_name: string | null;
}

const STORAGE_KEY = "recentSearches";
/** v1은 검색어 문자열 배열이었다. 상권 객체로 형식이 바뀌어 버전을 올리고, 구버전 데이터는 폐기한다. */
const STORAGE_VERSION = 2;
const MAX_ITEMS = 10;

function isRecentSearchItem(v: unknown): v is RecentSearchItem {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "number" &&
    typeof o.district_name === "string" &&
    (typeof o.gu_name === "string" || o.gu_name === null) &&
    (typeof o.dong_name === "string" || o.dong_name === null)
  );
}

function readStorage(): RecentSearchItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      parsed.version !== STORAGE_VERSION ||
      !Array.isArray(parsed.items)
    ) {
      return [];
    }
    return parsed.items.filter(isRecentSearchItem);
  } catch {
    return [];
  }
}

function writeStorage(items: RecentSearchItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, items }));
  } catch {
    // localStorage 접근 불가(프라이빗 모드 등) 시 조용히 무시.
  }
}

export function useRecentSearches() {
  const [items, setItems] = useState<RecentSearchItem[]>(() => readStorage());

  const addSearch = useCallback((item: RecentSearchItem) => {
    setItems((prev) => {
      const next = [item, ...prev.filter((v) => v.id !== item.id)].slice(0, MAX_ITEMS);
      writeStorage(next);
      return next;
    });
  }, []);

  const removeSearch = useCallback((id: number) => {
    setItems((prev) => {
      const next = prev.filter((v) => v.id !== id);
      writeStorage(next);
      return next;
    });
  }, []);

  return { items, addSearch, removeSearch };
}
