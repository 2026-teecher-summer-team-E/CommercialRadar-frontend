import { SignIn } from "@clerk/clerk-react";
import { Navigate } from "react-router-dom";
import { clerkEnabled } from "../lib/auth";
import styles from "./AuthPage.module.css";

export default function SignInPage() {
  // Clerk 키가 없으면(dev) 로그인 화면이 무의미하므로 앱으로 보낸다.
  if (!clerkEnabled) return <Navigate to="/" replace />;
  return (
    <div className={styles.wrap}>
      <div className={styles.col}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M9 4H6a2 2 0 0 0-2 2v3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M15 4h3a2 2 0 0 1 2 2v3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M20 15v3a2 2 0 0 1-2 2h-3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M9 20H6a2 2 0 0 1-2-2v-3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="12" r="2.4" fill="#fff" />
            </svg>
          </span>
          <span className={styles.brandText}>FOV</span>
        </div>
        <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" fallbackRedirectUrl="/" />
      </div>
    </div>
  );
}
