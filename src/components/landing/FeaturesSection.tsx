import { Link } from "react-router-dom";
import { buildSignInPath, clerkEnabled, useAuth } from "../../lib/auth";
import styles from "../../pages/LandingPage.module.css";
import { FEATURE_CARDS } from "./data";
import { ArrowRightIcon, CheckIcon } from "./icons";

/** 특징 3분할 섹션: 창업 결정에 필요한 모든 데이터. */
export default function FeaturesSection() {
  const { isLoaded, isSignedIn } = useAuth();
  const analysisPath = clerkEnabled && isLoaded && !isSignedIn ? buildSignInPath("/") : "/";

  return (
    <section className={styles.features}>
      <div className={styles.container}>
        <div className={styles.sectionHead}>
          <h2 className={styles.h2}>창업의 불안함을 확신으로 바꾸는 데이터</h2>
          <p className={styles.sectionSub}>
            유동인구 혼잡도, 업종별 생존율, 실제 매출 추이를 정확한 수치로 확인하고 창업하세요.
          </p>
        </div>

        <div className={styles.featureGrid}>
          {FEATURE_CARDS.map((card) => (
            <article key={card.title} className={styles.featureCard}>
              <h3 className={styles.featureTitle}>{card.title}</h3>
              <p className={styles.featureDesc}>{card.description}</p>
              <ul className={styles.checkList}>
                {card.items.map((item) => (
                  <li key={item} className={styles.checkItem}>
                    <CheckIcon size={13} className={styles.checkIcon} />
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <div className={styles.centerCta}>
          <Link to={analysisPath} className={`${styles.btnPrimary} ${styles.ctaLarge}`}>
            지금 바로 분석해보기
            <ArrowRightIcon size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
