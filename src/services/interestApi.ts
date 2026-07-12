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
  remove: (id: number) => apiClient.delete(`/api/interest-districts/${id}`),
};
