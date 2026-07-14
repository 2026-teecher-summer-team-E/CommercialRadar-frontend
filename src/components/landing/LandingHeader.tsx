import { Link } from "react-router-dom";
import { buildSignInPath, clerkEnabled, useAuth } from "../../lib/auth";
import styles from "../../pages/LandingPage.module.css";

/** 랜딩 자체 상단 헤더 (사이드바 없는 독립 레이아웃). 메인 앱 사이드바 로고와 아이콘/크기 통일. */
export default function LandingHeader() {
  const { isLoaded, isSignedIn } = useAuth();
  const appEntryPath = clerkEnabled && isLoaded && !isSignedIn ? buildSignInPath("/") : "/";

  return (
    <header className={styles.header}>
      <Link to="/landing" className={styles.brand}>
        <span className={styles.brandMark}>
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
      </Link>
      <div className={styles.headerActions}>
        <Link to={isSignedIn ? "/mypage" : "/sign-in"} className={styles.loginLink}>
          {isSignedIn ? "마이페이지" : "로그인"}
        </Link>
        <Link to={appEntryPath} className={styles.btnPrimary}>
          시작하기
        </Link>
      </div>
    </header>
  );
}
