import { useNavigate, useSearchParams } from "react-router-dom";
import AffordableFinder from "../components/simulator/AffordableFinder";
import styles from "./SimulatorPage.module.css";

/** 양수 정수 쿼리 파라미터만 통과시키고, 아니면 undefined. */
function parsePositiveParam(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export default function SimulatorPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // 랜딩 히어로 검색("임대료 1000만원 카페")에서 넘어온 예산(원)·면적(㎡)·업종 prefill.
  const initialBudget = parsePositiveParam(searchParams.get("budget"));
  const initialArea = parsePositiveParam(searchParams.get("area"));
  const initialCategory = searchParams.get("category") || undefined;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>창업 시뮬레이터</h1>
        <p className={styles.subtitle}>
          원하는 지역, 내 예산에 딱 맞는 최적의 상권 찾기
        </p>
      </header>
      <AffordableFinder
        onPick={(d) =>
          navigate(`/dashboard/${d.id}`, {
            // 상세분석에서 "이전 페이지로" 시 시뮬레이터로 복귀시키기 위해 진입 경로를 전달.
            state: { from: "/simulator" },
          })
        }
        initialBudget={initialBudget}
        initialArea={initialArea}
        initialCategory={initialCategory}
      />
    </div>
  );
}
