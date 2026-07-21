import { apiClient } from "../lib/apiClient";
import type {
  ReportCreateBody,
  ReportCreateOut,
  ReportDetailOut,
  ReportListResponse,
  ReportShareResponse,
  SharedReportView,
} from "../types";

export const reportsApi = {
  list: (params?: { page?: number; limit?: number }) =>
    apiClient.get<ReportListResponse>("/api/reports", { params }),
  get: (id: number | string) => apiClient.get<ReportDetailOut>(`/api/reports/${id}`),
  create: (body: ReportCreateBody) => apiClient.post<ReportCreateOut>("/api/reports", body),
  share: (id: number) => apiClient.post<ReportShareResponse>(`/api/reports/${id}/share`),
  getShared: (token: string) => apiClient.get<SharedReportView>(`/api/reports/share/${token}`),
  remove: (id: number) => apiClient.delete(`/api/reports/${id}`),
};
