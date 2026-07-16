import type { SharedReportEntry } from "../types";

/**
 * 공유된 리포트 로컬 저장소.
 * 백엔드에 "내가 공유한 리포트 목록" 조회 API가 없어, 공유 시 받은 토큰/URL을
 * 브라우저(localStorage)에 보관해 마이페이지 공유 탭을 채운다. (기기·브라우저 종속)
 */
const STORAGE_KEY = "cr:shared-reports";

/** 저장소가 바뀌었음을 같은 탭 내 다른 컴포넌트에 알리는 커스텀 이벤트명. */
export const SHARED_REPORTS_EVENT = "cr:shared-reports-changed";

function read(): SharedReportEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as SharedReportEntry[]) : [];
  } catch {
    return [];
  }
}

function write(entries: SharedReportEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    window.dispatchEvent(new Event(SHARED_REPORTS_EVENT));
  } catch {
    /* 저장 실패(사파리 프라이빗 등)는 조용히 무시 */
  }
}

/** 공유된 리포트 목록. 최근 공유가 앞에 오도록 정렬된 상태로 보관된다. */
export function getSharedReports(): SharedReportEntry[] {
  return read();
}

/** 공유 항목을 추가(같은 id 는 최신으로 갱신)하고 갱신된 목록을 반환. */
export function addSharedReport(entry: SharedReportEntry): SharedReportEntry[] {
  const next = [entry, ...read().filter((e) => e.id !== entry.id)];
  write(next);
  return next;
}

/** 공유 목록에서 항목을 제거하고 갱신된 목록을 반환. */
export function removeSharedReport(id: number): SharedReportEntry[] {
  const next = read().filter((e) => e.id !== id);
  write(next);
  return next;
}
