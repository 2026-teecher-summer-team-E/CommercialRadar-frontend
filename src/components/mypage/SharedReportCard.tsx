import type { SharedReportEntry } from "../../types";
import { formatDate, initialOf, seriesColor, seriesBg } from "./format";
import styles from "./mypage.module.css";

interface SharedReportCardProps {
  item: SharedReportEntry;
  index: number;
  onCopyLink: (url: string) => void;
  onRemove: (id: number) => void;
}

/** 공유한 리포트 1건 카드. 공유 링크 복사·열기·목록 제거를 제공한다. */
export default function SharedReportCard({ item, index, onCopyLink, onRemove }: SharedReportCardProps) {
  // share_url 은 프론트 상대경로(/reports/share/…). 복사·열기용 절대 URL로 변환.
  const fullUrl = new URL(item.share_url, window.location.origin).href;

  return (
    <li className={styles.card}>
      <span
        className={styles.cardMark}
        style={{ color: seriesColor(index), background: seriesBg(index) }}
        aria-hidden="true"
      >
        {initialOf(item.district_name ?? item.title)}
      </span>

      <div className={styles.cardBody}>
        <p className={styles.cardTitle}>{item.title}</p>
        <div className={styles.cardMeta}>
          {item.district_name && <span className={styles.chip}>{item.district_name}</span>}
          {item.category_name && <span className={styles.metaText}>{item.category_name}</span>}
          <span className={styles.metaDate}>{formatDate(item.shared_at)} 공유</span>
        </div>
      </div>

      <div className={styles.cardActions}>
        <button type="button" className={styles.linkBtn} onClick={() => onCopyLink(fullUrl)}>
          링크 복사
        </button>
        <a className={styles.linkBtn} href={fullUrl} target="_blank" rel="noreferrer">
          열기
        </a>
        <button
          type="button"
          className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
          onClick={() => onRemove(item.id)}
          aria-label="공유 목록에서 제거"
          title="목록에서 제거"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </li>
  );
}
