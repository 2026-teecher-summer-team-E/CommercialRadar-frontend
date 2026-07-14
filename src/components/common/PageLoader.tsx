import styles from "./PageLoader.module.css";

interface PageLoaderProps {
  /** 전체 화면 중앙(라우트 전환용). false면 카드/모달 내부에 맞는 인라인 높이만 차지. 기본 true. */
  fullScreen?: boolean;
}

/** lazy 컴포넌트 로딩 중 Suspense fallback으로 쓰는 공용 스피너. */
export default function PageLoader({ fullScreen = true }: PageLoaderProps) {
  return (
    <div className={fullScreen ? styles.fullScreen : styles.inline}>
      <div className={styles.spinner} role="status" aria-label="로딩 중" />
    </div>
  );
}
