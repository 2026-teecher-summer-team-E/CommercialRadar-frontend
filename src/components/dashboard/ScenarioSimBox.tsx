import styles from "./ScenarioSimBox.module.css";

interface ScenarioSimBoxProps {
  onScenarioClick: (s: "low" | "mid" | "high") => void;
}

/** 상권 앞 분위기 시뮬레이션 진입 버튼 3개(긍정적/중립/부정적 시나리오). */
export default function ScenarioSimBox({ onScenarioClick }: ScenarioSimBoxProps) {
  return (
    <div className={styles.scenarioBar}>
      <span className={styles.scenarioHint}>상권 분위기 시뮬레이션</span>
      <div className={styles.scenarioBtns}>
        <button
          type="button"
          className={`${styles.scenarioBtn} ${styles.scenarioBtnHigh}`}
          onClick={() => onScenarioClick("high")}
          aria-label="긍정적 시나리오 시뮬레이션 열기"
        >
          <span className={styles.scenarioDot} style={{ background: "var(--color-green)" }} />
          긍정적 시나리오
        </button>
        <button
          type="button"
          className={`${styles.scenarioBtn} ${styles.scenarioBtnMid}`}
          onClick={() => onScenarioClick("mid")}
          aria-label="중립 시나리오 시뮬레이션 열기"
        >
          <span className={styles.scenarioDot} style={{ background: "var(--series-1)" }} />
          중립 시나리오
        </button>
        <button
          type="button"
          className={`${styles.scenarioBtn} ${styles.scenarioBtnLow}`}
          onClick={() => onScenarioClick("low")}
          aria-label="부정적 시나리오 시뮬레이션 열기"
        >
          <span className={styles.scenarioDot} style={{ background: "var(--color-red)" }} />
          부정적 시나리오
        </button>
      </div>
    </div>
  );
}
