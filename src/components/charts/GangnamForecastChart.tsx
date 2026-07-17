import { useEffect, useRef, useState } from "react";
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
import { fmtEok } from "../dashboard/format";
import styles from "./GangnamForecastChart.module.css";

/** 툴팁 카드의 대략적인 폭(px) 추정치. 우측 경계 근접 판정에만 쓰이므로 정확할 필요는 없다. */
const TOOLTIP_WIDTH_ESTIMATE = 230;

const FORECAST_COLORS = {
  actual: "var(--series-2)",
  mid: "var(--series-1)",
  low: "var(--color-red)",
  high: "var(--color-green)",
  band: "var(--series-1)",
  surface: "var(--color-surface)",
  border: "var(--color-border)",
} as const;

interface Props {
  history: TimeseriesPoint[];
  forecast: TimeseriesPoint[];
  /** "won"=매출(억/조 단위), "won_sqm"=㎡당 임대료(원, 만원 단위 축약), "ratio"=생존율(%). */
  unit: "won" | "won_sqm" | "ratio";
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
// 항상 커서 중앙 아래에 붙인다(좌/우로 뒤집는 분기 없이 하나의 규칙만 적용 — 어떤 지점은
// 왼쪽에, 어떤 지점은 오른쪽에 붙어 산만해 보이던 문제 방지). 차트 경계 밖으로 나가지
// 않도록 이동량만 부드럽게 clamp한다.
function ForecastTooltip({
  active,
  payload,
  label,
  coordinate,
  formatValue,
  chartWidth,
}: {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: readonly any[];
  label?: string | number;
  coordinate?: { x?: number; y?: number };
  formatValue: (v: number) => string;
  chartWidth: number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const byKey: Record<string, unknown> = {};
  for (const p of payload) byKey[p.dataKey] = p.value;
  const order: [string, string, string][] = [
    ["actual", "실적", FORECAST_COLORS.actual],
    ["high", "Best", FORECAST_COLORS.high],
    ["mid", "Normal", FORECAST_COLORS.mid],
    ["low", "Worst", FORECAST_COLORS.low],
  ];
  const lines = order
    .map(([key, name, color]) => ({ name, color, value: byKey[key] }))
    .filter((r) => typeof r.value === "number");
  if (lines.length === 0) return null;

  // 툴팁 좌상단은 기본적으로 coordinate 지점(offset=0)에 놓인다. 가로 중앙을 커서에
  // 맞추려면 -폭/2 만큼 밀되, 차트 좌우 경계를 벗어나지 않도록 clamp한다.
  const cursorX = coordinate?.x ?? 0;
  const centerShift = -TOOLTIP_WIDTH_ESTIMATE / 2;
  const shiftX =
    chartWidth > 0
      ? Math.min(Math.max(centerShift, -cursorX), chartWidth - TOOLTIP_WIDTH_ESTIMATE - cursorX)
      : centerShift;

  return (
    <div
      style={{
        background: FORECAST_COLORS.surface,
        border: `1px solid ${FORECAST_COLORS.border}`,
        borderRadius: 8,
        padding: "8px 10px",
        fontSize: 13,
        transform: `translate(${shiftX}px, 10px)`,
        position: "relative",
        // 툴팁이 아래로 내려가 범례·시나리오 버튼과 겹칠 때도 항상 맨 위에 보이게 한다.
        zIndex: 50,
      }}
    >
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
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // 툴팁이 차트 우측 경계에 가까우면 왼쪽으로 밀어야 하므로, 실제 렌더링 폭을 측정해둔다.
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(0);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setChartWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const marginRight = endLabels ? 68 : 24;

  // draw-on: 실적/밴드와 예측 시나리오 라인을 모두 0ms에 함께 그려 동시에 나타나게 한다.
  const drawBase = sequentialDraw
    ? { isAnimationActive: true, animationBegin: 0, animationDuration: 700, animationEasing: "ease-out" as const }
    : {};
  const drawForecast = sequentialDraw
    ? { isAnimationActive: true, animationBegin: 0, animationDuration: 850, animationEasing: "ease-out" as const }
    : {};

  // rows 길이는 history + forecast 합산. makeDot은 rows 선언 전에 정의되므로 직접 계산.
  const totalRowCount = history.length + forecast.length;

  const makeDot =
    (scenario: "low" | "mid" | "high", color: string) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (props: any) => {
      const { cx, cy, value, index } = props;
      const key = `dot-${scenario}-${index}`;
      if (cx == null || cy == null || value == null) return <g key={key} />;
      const isLast = index === totalRowCount - 1;
      return (
        <g key={key} style={{ cursor: "pointer" }} onClick={() => onScenarioClick?.(scenario)}>
          <circle cx={cx} cy={cy} r={12} fill="transparent" />
          {/* 펄스 링: 마지막 점(시나리오 끝점)에만 표시, 모션 민감 사용자 제외 */}
          {isLast && !reducedMotion && (
            <circle cx={cx} cy={cy} fill="none" stroke={color} strokeWidth={1.5}>
              <animate attributeName="r" values="4;11" dur="1.8s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.55;0" dur="1.8s" repeatCount="indefinite" />
            </circle>
          )}
          <circle cx={cx} cy={cy} r={4} fill={color} stroke={FORECAST_COLORS.surface} strokeWidth={1.5} />
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

  const formatValue = (v: number) =>
    unit === "won" ? `${fmtEok(v)}원`
    : unit === "won_sqm" ? `₩${Math.round(v).toLocaleString("ko-KR")}/㎡`
    : formatRatio(v);
  const formatAxis = (v: number) =>
    unit === "won" ? `${Math.round(v / 1e8)}억`
    : unit === "won_sqm" ? `${(v / 10000).toFixed(1)}만`
    : `${Math.round(v * 100)}%`;
  // 분기 코드(2026-Q1)를 X축 라벨용 "26 1분기"로. 형식이 다르면 원본 그대로.
  const formatQuarter = (q: string) => {
    const m = /^(\d{4})-Q([1-4])$/.exec(q);
    return m ? `${m[1].slice(2)} ${m[2]}분기` : q;
  };

  const makeEndLabel =
    (scenario: "high" | "mid" | "low", color: string, dy: number) =>
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
          {pct}%
        </text>
      );
    };

  return (
    // position+z-index: 툴팁이 아래로 내려가 이 차트 바깥의 시나리오 버튼 영역과 겹칠 때도
    // 항상 위에 그려지도록, 차트 컨테이너 자체를 그 형제 요소보다 높은 스태킹에 둔다.
    <div ref={containerRef} className={styles.chartWrap} style={{ position: "relative", zIndex: 1 }}>
    <ResponsiveContainer width="100%" height={height}>
      {/* accessibilityLayer(recharts 기본 활성): 데이터 포인트를 키보드 포커스 가능한
          그룹으로 감싸는데, 클릭했을 때도 브라우저 기본 포커스 링(파란 사각 테두리)이
          점 3개 단위로 나타나 보였다. 이 차트는 별도 클릭(시나리오 선택) 핸들러가 있어
          꺼도 무방하다. */}
      <ComposedChart
        data={rows}
        margin={{ top: 16, right: marginRight, bottom: 8, left: 8 }}
        accessibilityLayer={false}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="quarter" tick={{ fontSize: 12 }} tickFormatter={formatQuarter} />
        <YAxis
          tickFormatter={formatAxis}
          width={64}
          tick={{ fontSize: 12 }}
          domain={yDomain ?? ["auto", "auto"]}
          allowDataOverflow={!!yDomain}
        />
        {/* allowEscapeViewBox: recharts 기본 동작은 툴팁이 차트 경계를 벗어나면 반대편으로
            뒤집어 배치해, 마우스가 차트 중앙을 넘나들 때 툴팁이 좌우로 튀어 보였다. 이를
            끄고, offset=0 으로 앵커를 커서 좌표 그대로 둔 뒤 ForecastTooltip 내부에서
            "항상 중앙 아래"라는 단일 규칙으로만 위치를 계산한다(좌/우 분기 없음).
            isAnimationActive: 기본값은 위치 이동에 400ms 트랜지션이 걸려있어, 빠르게
            마우스를 움직이면 이전 위치에서 뒤늦게 미끄러지듯 쫓아와 다음 위치와 겹쳐
            보였다. 꺼서 커서 이동에 즉시 스냅되게 한다. */}
        <Tooltip
          content={(props) => (
            <ForecastTooltip {...props} formatValue={formatValue} chartWidth={chartWidth} />
          )}
          allowEscapeViewBox={{ x: true, y: true }}
          offset={0}
          isAnimationActive={false}
          // wrapperStyle: 툴팁 내용물이 아니라 recharts가 만드는 wrapper 자체(범례
          // wrapper와 형제 관계)에 z-index를 줘야 범례 텍스트 위로 확실히 올라온다.
          wrapperStyle={{ zIndex: 50 }}
        />
        {/* itemSorter 기본값("value")은 라벨 텍스트를 가나다순 정렬해 "긍정적·부정적·중립"
            순으로 보이게 만든다. dataKey 기준 고정 순위로 긍정적·중립·부정적 순을 강제한다. */}
        <Legend
          wrapperStyle={{ transform: "translateX(40px)" }}
          itemSorter={(item) =>
            ({ high: 0, mid: 1, low: 2 } as Record<string, number>)[item.dataKey as string] ?? 99
          }
        />
        <Area
          dataKey="band"
          name="예측 범위"
          stroke="none"
          fill={FORECAST_COLORS.band}
          fillOpacity={0.12}
          connectNulls
          legendType="none"
          {...drawForecast}
        />
        {/* legendType="none": 범례에서 "실적"을 빼고 나머지 3개 시나리오만 보여준다. */}
        <Line type="monotone" dataKey="actual" name="실적" stroke={FORECAST_COLORS.actual} strokeWidth={2} dot={false} legendType="none" connectNulls {...drawBase} />
        <Line
          type="monotone"
          dataKey="high"
          name="Best"
          stroke={FORECAST_COLORS.high}
          strokeWidth={clickable ? 2.5 : 1.5}
          strokeDasharray="5 5"
          dot={clickable ? makeDot("high", FORECAST_COLORS.high) : false}
          label={makeEndLabel("high", FORECAST_COLORS.high, -6)}
          connectNulls
          {...drawForecast}
        />
        <Line
          type="monotone"
          dataKey="mid"
          name="Normal"
          stroke={FORECAST_COLORS.mid}
          strokeWidth={clickable ? 3 : 2}
          strokeDasharray="5 5"
          dot={clickable ? makeDot("mid", FORECAST_COLORS.mid) : { r: 2 }}
          label={makeEndLabel("mid", FORECAST_COLORS.mid, 4)}
          connectNulls
          {...drawForecast}
        />
        <Line
          type="monotone"
          dataKey="low"
          name="Worst"
          stroke={FORECAST_COLORS.low}
          strokeWidth={clickable ? 2.5 : 1.5}
          strokeDasharray="5 5"
          dot={clickable ? makeDot("low", FORECAST_COLORS.low) : false}
          label={makeEndLabel("low", FORECAST_COLORS.low, 14)}
          connectNulls
          {...drawForecast}
        />
      </ComposedChart>
    </ResponsiveContainer>
    </div>
  );
}
