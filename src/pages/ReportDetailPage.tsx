import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { reportsApi } from "../services/reportsApi";
import type { ReportDetailOut } from "../types";
import ReportView from "../components/reports/ReportView";
import { formatDate } from "../components/mypage/format";
import styles from "./ReportDetailPage.module.css";

/** 저장된 리포트 "보기" → 본인 리포트 단건 상세 (GET /api/reports/:id). */
export default function ReportDetailPage() {
  const { id } = useParams();
  const [report, setReport] = useState<ReportDetailOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) {
      setError(true);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(false);
    reportsApi
      .get(id)
      .then((res) => {
        if (alive) setReport(res.data);
      })
      .catch(() => {
        if (alive) setError(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.state}>리포트를 불러오고 있어요…</div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className={styles.page}>
        <div className={styles.state}>
          <p>리포트를 찾을 수 없어요.</p>
          <Link to="/mypage" className={styles.backLink}>
            마이페이지로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Link to="/mypage" className={styles.back}>
        ← 이전 페이지로
      </Link>
      <div className={styles.card}>
        <div className={styles.head}>
          <span className={styles.badge}>저장된 리포트</span>
          <span className={styles.date}>{formatDate(report.created_at)} 저장</span>
        </div>
        <ReportView report={report} />
      </div>
    </div>
  );
}
