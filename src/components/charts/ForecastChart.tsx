import { useId } from "react";

export interface ForecastPoint {
  label: string;
  /** 대표값(기본 시나리오 = 중앙값 P50). */
  value: number | null;
  /** 비관 시나리오(P10). 예측 구간에만 존재. 없으면 value로 폴백. */
  low?: number | null;
  /** 낙관 시나리오(P90). 예측 구간에만 존재. 없으면 value로 폴백. */
  high?: number | null;
  /** true면 예측 구간(점선). false/undefined면 실적 구간(실선). */
  forecast?: boolean;
}

interface ForecastChartProps {
  points: ForecastPoint[];
  width?: number;
  height?: number;
}

/**
 * 생존율 예측 라인차트(SVG 직접 구현).
 * 실적 구간은 실선, 예측 구간은 점선으로 그린다.
 * 예측 구간에는 부드러운 신뢰밴드(면적)를 채운다.
 */
export default function ForecastChart({ points, width = 560, height = 220 }: ForecastChartProps) {
  const gradId = useId();
  const valid = points.filter((p): p is ForecastPoint & { value: number } => p.value != null);
  if (valid.length < 2) {
    return null;
  }

  const padL = 12;
  const padR = 12;
  const padT = 18;
  const padB = 28;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  // y축 범위는 대표값뿐 아니라 비관/낙관 밴드까지 포함해 잘리지 않게 한다.
  const values = points
    .flatMap((p) => [p.value, p.low ?? null, p.high ?? null])
    .filter((v): v is number => v != null);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const span = rawMax - rawMin || 1;
  const min = rawMin - span * 0.25;
  const max = rawMax + span * 0.25;

  const x = (i: number) => padL + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => padT + innerH - ((v - min) / (max - min)) * innerH;

  // 실적/예측 경계 인덱스를 찾아 두 개의 폴리라인으로 분할.
  const coords = points.map((p, i) => ({
    i,
    v: p.value,
    // 밴드는 경계(실적 마지막)점에서 대표값으로 수렴하도록 low/high 폴백.
    low: p.low ?? p.value,
    high: p.high ?? p.value,
    forecast: !!p.forecast,
  }));
  const actualPts = coords.filter((c) => c.v != null && !c.forecast);
  const firstForecastIdx = coords.findIndex((c) => c.forecast);
  // 예측 라인은 실적 마지막 점부터 이어지도록 경계점을 포함시킨다.
  const forecastStart = firstForecastIdx > 0 ? firstForecastIdx - 1 : firstForecastIdx;
  const forecastPts =
    firstForecastIdx === -1
      ? []
      : coords.slice(forecastStart).filter((c) => c.v != null);

  const toPath = (arr: Array<{ i: number; v: number | null }>) =>
    arr
      .filter((c) => c.v != null)
      .map((c, k) => `${k === 0 ? "M" : "L"}${x(c.i).toFixed(1)},${y(c.v as number).toFixed(1)}`)
      .join(" ");

  const actualPath = toPath(actualPts);
  const forecastPath = toPath(forecastPts);

  // 3가지 미래: 비관(P10)~낙관(P90) 실제 시나리오로 신뢰밴드(면적)를 그린다.
  const bandTop = forecastPts.map((c) => `${x(c.i).toFixed(1)},${y((c.high ?? c.v) as number).toFixed(1)}`);
  const bandBottom = forecastPts
    .map((c) => `${x(c.i).toFixed(1)},${y((c.low ?? c.v) as number).toFixed(1)}`)
    .reverse();
  const bandPath =
    forecastPts.length >= 2 ? `M${bandTop.join(" L")} L${bandBottom.join(" L")} Z` : "";
  // 밴드 경계선(낙관/비관)을 얇은 점선으로 명시.
  const highPath = toPath(forecastPts.map((c) => ({ i: c.i, v: c.high })));
  const lowPath = toPath(forecastPts.map((c) => ({ i: c.i, v: c.low })));

  const lastPt = valid[valid.length - 1];
  const lastIdx = points.indexOf(lastPt as ForecastPoint);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      role="img"
      aria-label="생존율 예측 추이"
      style={{ display: "block", overflow: "visible" }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.16" />
          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* 신뢰밴드 (비관 P10 ~ 낙관 P90) */}
      {bandPath && <path d={bandPath} fill={`url(#${gradId})`} stroke="none" />}

      {/* 낙관/비관 경계선 (얇은 점선) */}
      {highPath && (
        <path d={highPath} fill="none" stroke="var(--color-primary)" strokeWidth="1" strokeOpacity="0.45" strokeDasharray="2 3" />
      )}
      {lowPath && (
        <path d={lowPath} fill="none" stroke="var(--color-primary)" strokeWidth="1" strokeOpacity="0.45" strokeDasharray="2 3" />
      )}

      {/* 실적 실선 */}
      {actualPath && (
        <path d={actualPath} fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" />
      )}
      {/* 예측 점선 */}
      {forecastPath && (
        <path
          d={forecastPath}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="2.5"
          strokeDasharray="5 5"
          strokeLinecap="round"
        />
      )}

      {/* 데이터 포인트 */}
      {points.map((p, i) =>
        p.value == null ? null : (
          <circle
            key={i}
            cx={x(i)}
            cy={y(p.value)}
            r={i === lastIdx ? 4.5 : 3}
            fill="var(--color-surface)"
            stroke="var(--color-primary)"
            strokeWidth="2"
          />
        ),
      )}

      {/* 마지막 값 라벨 */}
      {lastPt && (
        <text
          x={Math.min(x(lastIdx) + 6, width - 2)}
          y={y(lastPt.value) - 8}
          fontSize="12"
          fontWeight="700"
          fill="var(--color-primary)"
          textAnchor="end"
          fontFamily="var(--font-num)"
        >
          {`${lastPt.value.toFixed(0)}%`}
        </text>
      )}

      {/* X축 라벨 */}
      {points.map((p, i) => (
        <text
          key={`lbl-${i}`}
          x={x(i)}
          y={height - 8}
          fontSize="10"
          fill="var(--color-faint)"
          textAnchor="middle"
        >
          {p.label}
        </text>
      ))}
    </svg>
  );
}
