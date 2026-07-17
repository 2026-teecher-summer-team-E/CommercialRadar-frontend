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
          월 임대료 예산을 넣으면 그 예산으로 창업할 수 있는 상권을 저렴한 순으로 찾아줍니다. 상권을 누르면
          상세 분석으로 이동합니다.
        </p>
      </header>
      <AffordableFinder onPick={(d) => navigate(`/dashboard/${d.id}`)} />
    </div>
  );
}
