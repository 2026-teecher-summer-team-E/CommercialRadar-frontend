import { useNavigate } from "react-router-dom";
import type { InterestDistrict } from "../../types";
import { formatDate, initialOf, seriesColor, seriesBg } from "./format";
import styles from "./mypage.module.css";

/** 관심 상권 1건 카드. 클릭 시 랭킹처럼 상권 대시보드로 이동. */
export default function InterestCard({
  item,
  index,
}: {
  item: InterestDistrict;
  index: number;
}) {
  const navigate = useNavigate();
  const title = item.district_name ?? `상권 #${item.commercial_district_id}`;
  const goDashboard = () => navigate(`/dashboard/${item.commercial_district_id}`);
  return (
    <li
      className={`${styles.card} ${styles.cardClickable}`}
      onClick={goDashboard}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          goDashboard();
        }
      }}
    >
      <span
        className={styles.cardMark}
        style={{ color: seriesColor(index), background: seriesBg(index) }}
        aria-hidden="true"
      >
        {initialOf(title)}
      </span>

      <div className={styles.cardBody}>
        <p className={styles.cardTitle}>{title}</p>
        <div className={styles.cardMeta}>
          {item.category_name && (
            <span className={styles.chip}>{item.category_name}</span>
          )}
          <span className={styles.metaDate}>{formatDate(item.created_at)}</span>
        </div>
        {item.memo && <p className={styles.cardMemo}>{item.memo}</p>}
      </div>
    </li>
  );
}
