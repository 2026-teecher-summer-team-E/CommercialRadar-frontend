import styles from "../../pages/LandingPage.module.css";
import { STATS } from "./data";

/** 통계 숫자 스트립. */
export default function StatsSection() {
  return (
    <section className={styles.stats}>
      <div className={styles.container}>
        <div className={styles.statGrid}>
          {STATS.map((stat) => (
            <div key={stat.label} className={styles.statCell}>
              <div className={styles.statValue}>{stat.value}</div>
              <div className={styles.statLabel}>{stat.label}</div>
              <div className={styles.statNote}>{stat.note}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
