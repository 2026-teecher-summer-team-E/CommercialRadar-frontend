import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { TimeseriesPoint } from "../../types";
import { formatCurrency } from "../../utils/formatters";

interface Props {
  history: TimeseriesPoint[];
  forecast: TimeseriesPoint[];
  unit: "won" | "ratio";
  onScenarioClick?: (scenario: "low" | "mid" | "high") => void;
  /** 차트 높이(px). 기본 380. */
  height?: number;
  /** Y축 도메인(예: [0.8, 1]). 미지정 시 recharts 자동. */
  yDomain?: [number, number];
  /** 시나리오 선 끝에 직접 라벨 표시. 기본 false. */
  endLabels?: boolean;
  /** 실적 → 예측 순으로 라인이 그려지는 순차 draw-on 애니메이션. 기본 false. */
  sequentialDraw?: boolean;
}

interface Row {
  quarter: string;
  actual: number | null;
  low: number | null;
  mid: number | null;
  high: number | null;
  band: [number, number] | null;
}

/** unit="ratio"일 때 "93.2% · 100곳 중 93곳" 형식으로 변환. */
function formatRatio(v: number): string {
  const pct = (v * 100).toFixed(1);
  const survivors = Math.round(v * 100);
  return `${pct}% · 100곳 중 ${survivors}곳`;
}

// NaN 버그 수정: 밴드([low,high] 튜플)를 제외하고 실적/시나리오만 포맷 표시.
function ForecastTooltip({
  active,
  payload,
  label,
  formatValue,
}: {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: readonly any[];
  label?: string | number;
  formatValue: (v: number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const byKey: Record<string, unknown> = {};
  for (const p of payload) byKey[p.dataKey] = p.value;
  const order: [string, string, string][] = [
    ["actual", "실적", "#111827"],
    ["mid", "보통 미래(p50)", "#2563eb"],
    ["low", "안풀린 미래(p10)", "#dc2626"],
    ["high", "잘풀린 미래(p90)", "#16a34a"],
  ];
  const lines = order
    .map(([key, name, color]) => ({ name, color, value: byKey[key] }))
    .filter((r) => typeof r.value === "number");
  if (lines.length === 0) return null;
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e5ec", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      {lines.map((r) => (
        <div key={r.name} style={{ color: r.color }}>
          {r.name}: {formatValue(r.value as number)}
        </div>
      ))}
    </div>
  );
}

export default function ForecastChart({ history, forecast, unit, onScenarioClick, height = 380, yDomain, endLabels = false, sequentialDraw = false }: Props) {
  const clickable = !!onScenarioClick;

  // 순차 draw: 실적/밴드(0ms)가 먼저 그려지고, 예측 시나리오 라인은 뒤이어 그려진다.
  const drawBase = sequentialDraw
    ? { isAnimationActive: true, animationBegin: 0, animationDuration: 700, animationEasing: "ease-out" as const }
    : {};
  const drawForecast = sequentialDraw
    ? { isAnimationActive: true, animationBegin: 650, animationDuration: 850, animationEasing: "ease-out" as const }
    : {};

  const makeDot =
    (scenario: "low" | "mid" | "high", color: string) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (props: any) => {
      const { cx, cy, value, index } = props;
      const key = `dot-${scenario}-${index}`;
      if (cx == null || cy == null || value == null) return <g key={key} />;
      return (
        <g key={key} style={{ cursor: "pointer" }} onClick={() => onScenarioClick?.(scenario)}>
          <circle cx={cx} cy={cy} r={12} fill="transparent" />
          <circle cx={cx} cy={cy} r={4} fill={color} stroke="#fff" strokeWidth={1} />
        </g>
      );
    };

  const rows: Row[] = [
    ...history.map((p) => ({
      quarter: p.year_quarter,
      actual: p.value,
      low: null as number | null,
      mid: null as number | null,
      high: null as number | null,
      band: null as [number, number] | null,
    })),
    ...forecast.map((p) => {
      const low = (p.low ?? p.value) as number | null;
      const mid = (p.mid ?? p.value) as number | null;
      const high = (p.high ?? p.value) as number | null;
      return {
        quarter: p.year_quarter,
        actual: null as number | null,
        low,
        mid,
        high,
        band: low != null && high != null ? ([low, high] as [number, number]) : null,
      };
    }),
  ];

  // 경계 연결: 마지막 과거점이 세 시나리오·밴드의 시작점.
  if (history.length > 0 && forecast.length > 0) {
    const b = rows[history.length - 1];
    const a = b.actual;
    b.low = a;
    b.mid = a;
    b.high = a;
    b.band = a != null ? [a, a] : null;
  }

  const formatValue = (v: number) => (unit === "won" ? formatCurrency(v) : formatRatio(v));
  const formatAxis = (v: number) =>
    unit === "won" ? `${Math.round(v / 1e8)}억` : `${Math.round(v * 100)}%`;

  const makeEndLabel =
    (scenario: "high" | "mid" | "low", color: string, labelText: string, dy: number) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (props: any) => {
      const { x, y, index, value } = props;
      if (!endLabels || unit !== "ratio") return null;
      if (index !== rows.length - 1) return null;
      if (value == null) return null;
      const pct = Math.round(value * 100);
      return (
        <text
          key={`end-label-${scenario}`}
          x={x + 6}
          y={y}
          dy={dy}
          fill={color}
          fontSize={11}
          fontWeight={700}
          textAnchor="start"
        >
          {labelText} {pct}%
        </text>
      );
    };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ top: 16, right: endLabels ? 68 : 24, bottom: 8, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="quarter" tick={{ fontSize: 12 }} />
        <YAxis
          tickFormatter={formatAxis}
          width={64}
          tick={{ fontSize: 12 }}
          domain={yDomain ?? ["auto", "auto"]}
          allowDataOverflow={!!yDomain}
        />
        <Tooltip content={(props) => <ForecastTooltip {...props} formatValue={formatValue} />} />
        <Legend />
        <Area
          dataKey="band"
          name="예측 범위"
          stroke="none"
          fill="#6366f1"
          fillOpacity={0.12}
          connectNulls
          legendType="none"
          {...drawForecast}
        />
        <Line type="monotone" dataKey="actual" name="실적" stroke="#111827" strokeWidth={2} dot={false} connectNulls {...drawBase} />
        <Line
          type="monotone"
          dataKey="high"
          name="잘풀린 미래(p90)"
          stroke="#16a34a"
          strokeWidth={clickable ? 2.5 : 1.5}
          strokeDasharray="5 5"
          dot={clickable ? makeDot("high", "#16a34a") : false}
          label={makeEndLabel("high", "#16a34a", "잘풀린", -6)}
          connectNulls
          {...drawForecast}
        />
        <Line
          type="monotone"
          dataKey="mid"
          name="보통 미래(p50)"
          stroke="#2563eb"
          strokeWidth={clickable ? 3 : 2}
          strokeDasharray="5 5"
          dot={clickable ? makeDot("mid", "#2563eb") : { r: 2 }}
          label={makeEndLabel("mid", "#2563eb", "보통", 4)}
          connectNulls
          {...drawForecast}
        />
        <Line
          type="monotone"
          dataKey="low"
          name="안풀린 미래(p10)"
          stroke="#dc2626"
          strokeWidth={clickable ? 2.5 : 1.5}
          strokeDasharray="5 5"
          dot={clickable ? makeDot("low", "#dc2626") : false}
          label={makeEndLabel("low", "#dc2626", "안풀린", 14)}
          connectNulls
          {...drawForecast}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
