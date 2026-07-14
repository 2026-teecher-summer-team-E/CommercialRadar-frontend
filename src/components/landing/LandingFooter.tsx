import styles from "../../pages/LandingPage.module.css";

/** 다크 푸터. */
export default function LandingFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerBrand}>
          <span className={styles.footerBrandMark}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M10.8 17.1a6.3 6.3 0 1 0 0-12.6 6.3 6.3 0 0 0 0 12.6Z"
                stroke="#fff"
                strokeWidth="2.2"
              />
              <path d="m15.4 15.4 4.1 4.1" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
              <path d="M8.4 9.1a3.2 3.2 0 0 1 2.4-1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </span>
          상권레이더
        </div>
        <p className={styles.footerText}>
          공공데이터포털 · 서울 열린데이터광장 기반 분석 서비스
        </p>
        <p className={styles.footerCopy}>© 2026 District Pulse. All rights reserved.</p>
      </div>
    </footer>
  );
}
