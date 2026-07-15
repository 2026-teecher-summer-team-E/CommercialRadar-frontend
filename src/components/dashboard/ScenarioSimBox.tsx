import styles from "./ScenarioSimBox.module.css";

interface ScenarioSimBoxProps {
  onScenarioClick: (s: "low" | "mid" | "high") => void;
}

/** 상권 분위기 시뮬레이션 진입 버튼 3개(잘풀린/보통/안풀린 미래). */
export default function ScenarioSimBox({ onScenarioClick }: ScenarioSimBoxProps) {
  return (
    <div className={styles.scenarioBar}>
      <span className={styles.scenarioHint}>상권 분위기 시뮬레이션</span>
      <div className={styles.scenarioBtns}>
        <button
          type="button"
          className={`${styles.scenarioBtn} ${styles.scenarioBtnHigh}`}
          onClick={() => onScenarioClick("high")}
          aria-label="잘풀린 미래 시뮬레이션 열기"
        >
          <span className={styles.scenarioDot} style={{ background: "var(--color-green)" }} />
          잘풀린 미래
        </button>
        <button
          type="button"
          className={`${styles.scenarioBtn} ${styles.scenarioBtnMid}`}
          onClick={() => onScenarioClick("mid")}
          aria-label="보통 미래 시뮬레이션 열기"
        >
          <span className={styles.scenarioDot} style={{ background: "var(--series-1)" }} />
          보통 미래
        </button>
        <button
          type="button"
          className={`${styles.scenarioBtn} ${styles.scenarioBtnLow}`}
          onClick={() => onScenarioClick("low")}
          aria-label="안풀린 미래 시뮬레이션 열기"
        >
          <span className={styles.scenarioDot} style={{ background: "var(--color-red)" }} />
          안풀린 미래
        </button>
      </div>
    </div>
  );
}
