import { Link } from "react-router-dom";
import { buildSignInPath, clerkEnabled, useAuth } from "../../lib/auth";
import styles from "../../pages/LandingPage.module.css";
import { AUDIENCE_CARDS } from "./data";
import { ArrowRightIcon } from "./icons";

/** 나는 어떤 분석이 필요한가요?: 대상별 경로 카드. */
export default function AudienceSection() {
  const { isLoaded, isSignedIn } = useAuth();
  const getCardPath = (path: string) =>
    clerkEnabled && isLoaded && !isSignedIn ? buildSignInPath(path) : path;

  return (
    <section className={styles.audience}>
      <div className={styles.container}>
        <div className={styles.sectionHead}>
          <p className={styles.eyebrow}></p>
          <h2 className={styles.h2}>상황별 맞춤 상권 분석</h2>
          <p className={styles.sectionSub}>창업 준비, 매장 운영, 출점 전략 등 목적에 맞는 최적의 분석 도구를 제공합니다.</p>
        </div>

        <div className={styles.audienceGrid}>
          {AUDIENCE_CARDS.map((card) => (
            <article key={card.title} className={styles.audienceCard}>
              <span className={styles.audienceTag}>{card.tag}</span>
              <h3 className={styles.audienceTitle}>{card.title}</h3>
              <p className={styles.audienceDesc}>{card.description}</p>
              <Link to={getCardPath(card.to)} className={`${styles.btnPrimary} ${styles.audienceCta}`}>
                {card.cta}
                <ArrowRightIcon size={14} />
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
