import { useEffect, useState } from "react";

import AtmosphereSimulation, {
  type AtmoScenario,
} from "../components/charts/AtmosphereSimulation";
import ForecastChart from "../components/charts/GangnamForecastChart";
import { useTimeseries } from "../hooks/useTimeseries";
import { forecastApi } from "../services/forecastApi";
import type { AgeSlice } from "../types";

const DISTRICT_ID = 1315;
const CATEGORY = "커피-음료";

export default function GangnamCafeDemoPage() {
  const [metric, setMetric] = useState<"sales" | "survival">("sales");
  const cumulative = metric === "survival";
  const { data, loading, error } = useTimeseries(DISTRICT_ID, CATEGORY, metric, cumulative);

  const [sim, setSim] = useState<AtmoScenario | null>(null);
  const [ages, setAges] = useState<AgeSlice[]>([]);

  useEffect(() => {
    let cancelled = false;
    forecastApi
      .getPopulationAge(DISTRICT_ID)
      .then((res) => {
        if (!cancelled) setAges((res.data?.slices ?? []) as AgeSlice[]);
      })
      .catch(() => {
        if (!cancelled) setAges([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 삼항 조건에 `data && …`를 인라인으로 둬야 true 브랜치에서 data가 non-null로 내로잉된다.
  // (const hasData 로 빼면 strict 모드에서 data가 null 가능으로 남아 타입 에러가 난다.)
  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 16 }}>
      <h1>강남역 상권 · 카페(커피-음료)</h1>
      <p style={{ color: "#555" }}>
        {metric === "survival"
          ? "누적 생존율(복리) — 창업 시점 대비 살아남은 비율. 시간이 갈수록 감소하며, 미래는 가능한 범위(안풀린·보통·잘풀린 미래, 점선 + 밴드)."
          : "과거 실적(실선)과 가능한 미래 범위(안풀린·보통·잘풀린 미래, 점선 + 밴드)."}
      </p>

      <div style={{ display: "flex", gap: 8, margin: "16px 0" }}>
        <button onClick={() => setMetric("sales")} disabled={metric === "sales"}>매출</button>
        <button onClick={() => setMetric("survival")} disabled={metric === "survival"}>생존율</button>
      </div>

      {loading && <p>데모 데이터를 분석하는 중…</p>}
      {!!error && <p>데이터를 불러오지 못했습니다.</p>}
      {data && (data.history.length > 0 || data.forecast.length > 0) ? (
        <>
          <ForecastChart history={data.history} forecast={data.forecast} unit={data.unit} onScenarioClick={setSim} />
          <p style={{ color: "#8b90a0", fontSize: 13, marginTop: 4 }}>
            미래 선(안풀린·보통·잘풀린)을 클릭하면 그 미래의 <b>상권 분위기</b>가 재생됩니다.
          </p>
        </>
      ) : (
        !loading && !error && <p>표시할 데이터가 없습니다.</p>
      )}

      {sim && <AtmosphereSimulation scenario={sim} ageDistribution={ages} onClose={() => setSim(null)} />}
    </div>
  );
}
