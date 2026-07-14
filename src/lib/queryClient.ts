import { QueryClient } from "@tanstack/react-query";

/**
 * 앱 전역 쿼리 캐시. 상권 데이터는 분기 단위로 갱신되므로 staleTime 을 길게 잡아
 * 페이지 재진입 시 재요청 없이 캐시를 그대로 쓴다(백엔드 캐시와 이중 캐시).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 60 * 1000, // 30분간 fresh — 그동안 재요청 없음
      gcTime: 60 * 60 * 1000, // 화면에서 안 쓰는 캐시도 1시간 보관
      retry: 1,
      refetchOnWindowFocus: false, // 분기 데이터라 포커스 복귀 재검증 불필요
    },
  },
});
