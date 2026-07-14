import { SignUp } from "@clerk/clerk-react";
import { Navigate } from "react-router-dom";
import { clerkEnabled } from "../lib/auth";
import styles from "./AuthPage.module.css";

export default function SignUpPage() {
  if (!clerkEnabled) return <Navigate to="/" replace />;
  return (
    <div className={styles.wrap}>
      <div className={styles.col}>
        <div className={styles.brand}>
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
          <span className={styles.brandText}>상권레이더</span>
        </div>
        <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" fallbackRedirectUrl="/" />
      </div>
    </div>
  );
}
