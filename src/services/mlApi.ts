import { apiClient } from "../lib/apiClient";
import type { SurvivalForecastResponse, SalesForecastResponse, RentForecastResponse } from "../types";

export const mlApi = {
  /** 실제 구현 경로. (구 /api/forecast/survival 스텁이 아님) */
  survivalForecast: (id: number | string, params?: Record<string, string>) =>
    apiClient.get<SurvivalForecastResponse>(`/api/commercial-districts/${id}/survival-forecast`, { params }),

  /** 매출 예측. category_name 지정 시 업종 단위(강남역만 적재), 생략 시 상권 전체(__ALL__). */
  salesForecast: (id: number | string, params?: Record<string, string>) =>
    apiClient.get<SalesForecastResponse>(`/api/commercial-districts/${id}/sales-forecast`, { params }),

  /** 임대료 예측. floor_type(소규모/중대형/집합)마다 독립 시계열이라 유형별로 따로 호출한다. */
  rentForecast: (id: number | string, params?: Record<string, string>) =>
    apiClient.get<RentForecastResponse>(`/api/commercial-districts/${id}/rent-forecast`, { params }),
};
