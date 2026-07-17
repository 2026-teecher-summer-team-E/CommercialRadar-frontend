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
            <path d="M9 4H6a2 2 0 0 0-2 2v3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M15 4h3a2 2 0 0 1 2 2v3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M20 15v3a2 2 0 0 1-2 2h-3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9 20H6a2 2 0 0 1-2-2v-3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="12" cy="12" r="2.4" fill="#fff" />
          </svg>
        </span>
        FOV
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
