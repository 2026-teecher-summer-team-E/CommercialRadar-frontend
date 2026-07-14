import { apiClient } from "../lib/apiClient";
import type { SurvivalForecastResponse, SalesForecastResponse } from "../types";

export const mlApi = {
  /** 실제 구현 경로. (구 /api/forecast/survival 스텁이 아님) */
  survivalForecast: (id: number | string, params?: Record<string, string>) =>
    apiClient.get<SurvivalForecastResponse>(`/api/commercial-districts/${id}/survival-forecast`, { params }),

  /** 매출 예측. category_name 지정 시 업종 단위(강남역만 적재), 생략 시 상권 전체(__ALL__). */
  salesForecast: (id: number | string, params?: Record<string, string>) =>
    apiClient.get<SalesForecastResponse>(`/api/commercial-districts/${id}/sales-forecast`, { params }),
};
