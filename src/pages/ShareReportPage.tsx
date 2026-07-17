import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { reportsApi } from "../services/reportsApi";
import type { SharedReportView } from "../types";
import ReportView from "../components/reports/ReportView";
import styles from "./ShareReportPage.module.css";

/** 공유 링크(/reports/share/:token)로 접근하는 비로그인 공개 리포트 뷰. */
export default function ShareReportPage() {
  const { token } = useParams();
  const [report, setReport] = useState<SharedReportView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!token) {
      setError(true);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(false);
    reportsApi
      .getShared(token)
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
  }, [token]);

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
          <p>공유된 리포트를 찾을 수 없어요.</p>
          <p className={styles.stateSub}>링크가 만료되었거나 삭제된 리포트일 수 있어요.</p>
          <Link to="/landing" className={styles.homeLink}>
            FOV 홈으로
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <span className={styles.badge}>공유 리포트</span>
        <ReportView report={report} />
        <div className={styles.footer}>
          <span className={styles.footNote}>FOV에서 공유된 상권 분석 리포트입니다.</span>
          <Link to="/landing" className={styles.homeLink}>
            직접 분석해보기
          </Link>
        </div>
      </div>
    </div>
  );
}
