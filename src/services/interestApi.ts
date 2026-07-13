import { apiClient } from "../lib/apiClient";
import type { InterestDistrict } from "../types";

export interface InterestDistrictCreate {
  commercial_district_id: number;
  memo?: string | null;
  category_name?: string | null;
}

export const interestApi = {
  list: () => apiClient.get<InterestDistrict[]>("/api/interest-districts"),
  create: (body: InterestDistrictCreate) =>
    apiClient.post<InterestDistrict>("/api/interest-districts", body),
  /** 메모 수정. memo 만 변경 가능(카테고리 등은 수정 불가). */
  update: (id: number, body: { memo: string | null }) =>
    apiClient.patch<InterestDistrict>(`/api/interest-districts/${id}`, body),
  remove: (id: number) => apiClient.delete(`/api/interest-districts/${id}`),
};
