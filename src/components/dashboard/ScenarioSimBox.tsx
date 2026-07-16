import styles from "./ScenarioSimBox.module.css";

interface ScenarioSimBoxProps {
  onScenarioClick: (s: "low" | "mid" | "high") => void;
}

/** 상권 앞 분위기 시뮬레이션 진입 버튼 3개(Best/Normal/Worst). */
export default function ScenarioSimBox({ onScenarioClick }: ScenarioSimBoxProps) {
  return (
    <div className={styles.scenarioBar}>
      <div>
        <h3 className={styles.title}>상권 분위기 시뮬레이션</h3>
        <p className={styles.sub}>상황을 선택하면 예상 상권 변화를 시뮬레이션할 수 있어요</p>
      </div>
      <div className={styles.scenarioBtns}>
        <button
          type="button"
          className={`${styles.scenarioBtn} ${styles.scenarioBtnHigh}`}
          onClick={() => onScenarioClick("high")}
          aria-label="Best 시나리오 시뮬레이션 열기"
        >
          Best
        </button>
        <button
          type="button"
          className={`${styles.scenarioBtn} ${styles.scenarioBtnMid}`}
          onClick={() => onScenarioClick("mid")}
          aria-label="Normal 시나리오 시뮬레이션 열기"
        >
          Normal
        </button>
        <button
          type="button"
          className={`${styles.scenarioBtn} ${styles.scenarioBtnLow}`}
          onClick={() => onScenarioClick("low")}
          aria-label="Worst 시나리오 시뮬레이션 열기"
        >
          Worst
        </button>
      </div>
    </div>
  );
}
