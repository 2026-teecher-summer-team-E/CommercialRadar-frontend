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
import { formatCurrency, formatPercent } from "../../utils/formatters";

interface Props {
  history: TimeseriesPoint[];
  forecast: TimeseriesPoint[];
  unit: "won" | "ratio";
  onScenarioClick?: (scenario: "low" | "mid" | "high") => void;
  /** 차트 높이(px). 기본 380. */
  height?: number;
  /** Y축 도메인(예: [0.8, 1]). 미지정 시 recharts 자동. */
  yDomain?: [number, number];
}

interface Row {
  quarter: string;
  actual: number | null;
  low: number | null;
  mid: number | null;
  high: number | null;
  band: [number, number] | null;
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

export default function ForecastChart({ history, forecast, unit, onScenarioClick, height = 380, yDomain }: Props) {
  const clickable = !!onScenarioClick;

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

  const formatValue = (v: number) => (unit === "won" ? formatCurrency(v) : formatPercent(v));
  const formatAxis = (v: number) =>
    unit === "won" ? `${Math.round(v / 1e8)}억` : `${Math.round(v * 100)}%`;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ top: 16, right: 24, bottom: 8, left: 8 }}>
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
        />
        <Line type="monotone" dataKey="actual" name="실적" stroke="#111827" strokeWidth={2} dot={false} connectNulls />
        <Line
          type="monotone"
          dataKey="high"
          name="잘풀린 미래(p90)"
          stroke="#16a34a"
          strokeWidth={clickable ? 2.5 : 1.5}
          strokeDasharray="5 5"
          dot={clickable ? makeDot("high", "#16a34a") : false}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="mid"
          name="보통 미래(p50)"
          stroke="#2563eb"
          strokeWidth={clickable ? 3 : 2}
          strokeDasharray="5 5"
          dot={clickable ? makeDot("mid", "#2563eb") : { r: 2 }}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="low"
          name="안풀린 미래(p10)"
          stroke="#dc2626"
          strokeWidth={clickable ? 2.5 : 1.5}
          strokeDasharray="5 5"
          dot={clickable ? makeDot("low", "#dc2626") : false}
          connectNulls
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
