import type { ReportContent } from "../../types";
import styles from "./ReportView.module.css";

interface ReportViewData {
  title: string;
  district_name: string | null;
  category_name: string | null;
  memo: string | null;
  content: ReportContent;
}

/** 숫자 지표 포맷. null 이면 "지표없음". */
function fmt(value: number | null | undefined, opts: { suffix?: string; digits?: number } = {}): string {
  if (value == null || Number.isNaN(value)) return "지표없음";
  const { suffix = "", digits = 0 } = opts;
  return `${value.toLocaleString("ko-KR", { maximumFractionDigits: digits })}${suffix}`;
}

/** 리포트 지표 카드(공유 뷰·본인 상세 뷰 공용). 헤더/지표 그리드만 렌더하고 래퍼는 페이지가 담당. */
export default function ReportView({ report }: { report: ReportViewData }) {
  const c = report.content;
  const metrics: { label: string; value: string }[] = [
    { label: "종합점수", value: fmt(c.district_score, { digits: 1 }) },
    { label: "생존율", value: fmt(c.survival_rate, { suffix: "%", digits: 1 }) },
    { label: "폐업위험", value: fmt(c.closure_rate, { suffix: "%", digits: 1 }) },
    { label: "점포 수", value: fmt(c.total_business, { suffix: "개" }) },
    { label: "유동인구", value: fmt(c.avg_population, { suffix: "명" }) },
    { label: "기준분기", value: c.year_quarter ?? "지표없음" },
  ];

  return (
    <>
      <h1 className={styles.title}>{report.title}</h1>
      <div className={styles.meta}>
        {report.district_name && <span className={styles.chip}>{report.district_name}</span>}
        {report.category_name && <span className={styles.metaText}>{report.category_name}</span>}
      </div>
      {report.memo && <p className={styles.memo}>{report.memo}</p>}

      <div className={styles.grid}>
        {metrics.map((m) => (
          <div key={m.label} className={styles.cell}>
            <span className={styles.cellLabel}>{m.label}</span>
            <span className={styles.cellValue}>{m.value}</span>
          </div>
        ))}
      </div>
    </>
  );
}
