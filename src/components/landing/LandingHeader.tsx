import { Link } from "react-router-dom";
import styles from "../../pages/LandingPage.module.css";

/** 랜딩 자체 상단 헤더 (사이드바 없는 독립 레이아웃). 메인 앱 사이드바 로고와 아이콘/크기 통일. */
export default function LandingHeader() {
  return (
    <header className={styles.header}>
      <Link to="/landing" className={styles.brand}>
        <span className={styles.brandMark}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 6c-2.8 0-5 2.2-5 5 0 3.5 5 9 5 9s5-5.5 5-9c0-2.8-2.2-5-5-5zm0 6.8a1.8 1.8 0 110-3.6 1.8 1.8 0 010 3.6z"
              fill="#fff"
            />
          </svg>
        </span>
        상권레이더
      </Link>
      <div className={styles.headerActions}>
        <Link to="/sign-in" className={styles.loginLink}>
          로그인
        </Link>
        <Link to="/" className={styles.btnPrimary}>
          시작하기
        </Link>
      </div>
    </header>
  );
}
