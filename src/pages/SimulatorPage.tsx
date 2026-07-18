import { useNavigate } from "react-router-dom";
import AffordableFinder from "../components/simulator/AffordableFinder";
import styles from "./SimulatorPage.module.css";

export default function SimulatorPage() {
  const navigate = useNavigate();
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>창업 시뮬레이터</h1>
        <p className={styles.subtitle}>
          원하는 지역, 내 예산에 딱 맞는 최적의 상권 찾기
        </p>
      </header>
      <AffordableFinder onPick={(d) => navigate(`/dashboard/${d.id}`)} />
    </div>
  );
}
