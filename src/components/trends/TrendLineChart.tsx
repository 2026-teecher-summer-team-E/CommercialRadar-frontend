import { useState } from "react";
import styles from "./TrendLineChart.module.css";
import type { MetricMeta } from "./trendsFormat";

interface Props {
  labels: string[];
  /** points[i] 는 labels[i] 분기의 값. 없으면 null(포인트 스킵). */
  points: Array<number | null>;
  meta: MetricMeta;
  width?: number;
  height?: number;
}

/** 보기 좋은 tick 간격(1, 2, 2.5, 5, 10 × 10^n) 계산. */
function niceStep(span: number, targetTicks = 5): number {
  if (span <= 0) return 1;
  const rough = span / targetTicks;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const residual = rough / magnitude;
  const niceResidual = residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 5 ? 5 : 10;
  return niceResidual * magnitude;
}

const yearOf = (label: string) => label.slice(0, 4);

/** 문자 단위 대략 폭 추정(한글/한자 등 전각은 넓게, 영문/숫자/기호는 좁게). 캔버스 측정 없이 오버플로만 방지. */
function estimateTextWidth(text: string, fontSize = 10): number {
  let w = 0;
  for (const ch of text) {
    const isWide = (ch.codePointAt(0) ?? 0) > 0x2e80;
    w += fontSize * (isWide ? 1.05 : 0.58);
  }
  return w;
}

/**
 * 단일 지표 분기별 라인 차트(순수 SVG). 퍼센트 지표(생존율)는 100 고정 상한 +
 * 실제 최솟값보다 1%p 낮은 하한으로 작은 변화도 잘 보이게 하고, 그 외 지표는
 * 기존처럼 데이터 기반 스케일(±10% 여유)을 쓴다. X축은 연도 단위로만 표시하고
 * 분기 상세·전분기 대비 증감은 포인트 hover 시 tooltip으로 보여준다.
 */
export default function TrendLineChart({ labels, points, meta, width = 640, height = 280 }: Props) {
  if (labels.length === 0) return null;

  const padL = 52;
  const padR = 16;
  const padT = 24;
  const padB = 30;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const present = points.filter((v): v is number => v != null && !Number.isNaN(v));

  let yMin: number;
  let yMax: number;
  if (meta.fixed0to100) {
    yMax = 100;
    const dataMin = present.length > 0 ? Math.min(...present) : 0;
    yMin = present.length > 0 ? Math.max(0, dataMin - 1) : 0;
  } else if (present.length === 0) {
    yMin = 0;
    yMax = 1;
  } else {
    const dataMin = Math.min(...present);
    const dataMax = Math.max(...present);
    if (dataMin === dataMax) {
      // 단일 값: 0~값*1.2 범위로 여유를 준다.
      yMin = 0;
      yMax = dataMax === 0 ? 1 : dataMax * 1.2;
    } else {
      const span = dataMax - dataMin;
      yMin = Math.max(0, dataMin - span * 0.1);
      yMax = dataMax + span * 0.1;
    }
  }
  const yRange = yMax - yMin || 1;
  const step = niceStep(yRange);

  const xAt = (i: number) =>
    labels.length === 1 ? padL + plotW / 2 : padL + (plotW * i) / (labels.length - 1);
  const yAt = (v: number) => padT + plotH - (plotH * (v - yMin)) / yRange;

  const yTicks: number[] = [];
  for (let v = Math.ceil(yMin / step) * step; v <= yMax + 1e-9; v += step) {
    yTicks.push(Math.round(v * 100) / 100);
  }

  const coords = points
    .map((v, i) => (v == null || Number.isNaN(v) ? null : { i, x: xAt(i), y: yAt(v) }))
    .filter((c): c is { i: number; x: number; y: number } => c !== null);

  const linePath = coords.map((c) => `${c.x},${c.y}`).join(" ");
  const areaPath =
    coords.length > 1
      ? `M ${coords[0].x},${padT + plotH} ` +
        coords.map((c) => `L ${c.x},${c.y}`).join(" ") +
        ` L ${coords[coords.length - 1].x},${padT + plotH} Z`
      : "";

  const axisTitle = meta.fixed0to100 ? `${meta.label}(%)` : meta.label;

  const [hover, setHover] = useState<number | null>(null);

  return (
    <svg
      className={styles.svg}
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      role="img"
      aria-label={`분기별 ${meta.label} 추이 차트`}
    >
      <text className={styles.axisTitle} x={0} y={12}>
        {axisTitle}
      </text>

      {yTicks.map((t, i) => {
        const y = yAt(t);
        return (
          <g key={`yt-${i}`}>
            <line className={styles.grid} x1={padL} y1={y} x2={width - padR} y2={y} />
            <text
              className={styles.axisLabel}
              x={padL - 8}
              y={y}
              textAnchor="end"
              dominantBaseline="middle"
            >
              {meta.tick(t)}
            </text>
          </g>
        );
      })}

      {labels.map((label, i) => {
        if (i > 0 && yearOf(label) === yearOf(labels[i - 1])) return null;
        return (
          <text
            key={`xt-${i}`}
            className={styles.axisLabel}
            x={xAt(i)}
            y={height - padB + 18}
            textAnchor="middle"
          >
            {yearOf(label)}
          </text>
        );
      })}

      {areaPath && <path className={styles.area} d={areaPath} />}
      {coords.length > 0 && <polyline className={styles.line} points={linePath} />}
      {coords.map((c) => (
        <g key={`p-${c.i}`}>
          <circle className={styles.point} cx={c.x} cy={c.y} r={2.5} />
          <circle
            cx={c.x}
            cy={c.y}
            r={9}
            fill="transparent"
            onMouseEnter={() => setHover(c.i)}
            onMouseLeave={() => setHover(null)}
          />
        </g>
      ))}

      {hover != null &&
        (() => {
          const v = points[hover];
          if (v == null || Number.isNaN(v)) return null;
          const prevRaw = hover > 0 ? points[hover - 1] : null;
          const prev = prevRaw != null && !Number.isNaN(prevRaw) ? prevRaw : null;
          const delta = prev != null ? v - prev : null;

          const titleText = labels[hover];
          const row2Text = `${meta.label} ${meta.format(v)}`;
          const row3Text =
            delta == null
              ? "전분기 데이터 없음"
              : meta.fixed0to100
                ? `전분기 대비 ${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%p`
                : `전분기 대비 ${delta >= 0 ? "+" : "-"}${meta.format(Math.abs(delta))}`;

          const boxW = Math.max(
            76,
            estimateTextWidth(titleText, 7) + 10,
            estimateTextWidth(row2Text, 7) + 10,
            estimateTextWidth(row3Text, 7) + 10,
          );
          const boxH = 36;
          const x = xAt(hover);
          const y = yAt(v);
          const bx = Math.min(Math.max(x - boxW / 2, 2), width - boxW - 2);
          const by = y - boxH - 10 >= 0 ? y - boxH - 10 : y + 12;
          const rowH = boxH / 3;

          return (
            <g className={styles.tooltip} transform={`translate(${bx}, ${by})`}>
              <rect className={styles.tooltipBg} width={boxW} height={boxH} rx={5} />
              <text
                className={styles.tooltipTitle}
                x={boxW / 2}
                y={rowH * 0.5}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {titleText}
              </text>
              <text
                className={styles.tooltipRow}
                x={boxW / 2}
                y={rowH * 1.5}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {row2Text}
              </text>
              <text
                className={styles.tooltipRow}
                x={boxW / 2}
                y={rowH * 2.5}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {row3Text}
              </text>
            </g>
          );
        })()}
    </svg>
  );
}
