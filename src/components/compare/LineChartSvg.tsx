import { useState } from "react";
import { seriesColor } from "./format";
import styles from "./LineChartSvg.module.css";

export interface LineSeries {
  name: string;
  /** points[i] 는 labels[i] 분기의 값. 없으면 null(포인트 스킵). */
  points: Array<number | null>;
}

interface Props {
  labels: string[];
  series: LineSeries[];
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
 * 다중 상권 오버레이 라인 차트(순수 SVG). 분기별 생존율(%) 스냅샷을 그대로 표시.
 * Y축 상한은 100 고정, 하한은 실제 최솟값보다 1%p 낮게 잡아 작은 변화도 잘 보이게 한다.
 * X축은 연도 단위로만 라벨을 표시하고(분기 상세는 tooltip), tick은 보기 좋은 간격으로 자동 계산.
 */
export default function LineChartSvg({ labels, series, width = 900, height = 450 }: Props) {
  if (labels.length === 0) return null;

  const padL = 36;
  const padR = 10;
  const padT = 22;
  const padB = 28;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const values = series.flatMap((s) => s.points.filter((v): v is number => v != null));
  const dataMin = values.length > 0 ? Math.min(...values) : 0;

  const yMax = 100;
  const yMin = values.length > 0 ? Math.max(0, dataMin - 1) : 0;
  const step = niceStep(yMax - yMin);
  const tickDecimals = Number.isInteger(step) ? 0 : 1;

  const xAt = (i: number) =>
    labels.length === 1 ? padL + plotW / 2 : padL + (plotW * i) / (labels.length - 1);
  const yAt = (v: number) => padT + plotH - (plotH * (v - yMin)) / (yMax - yMin);

  const yTicks: number[] = [];
  for (let v = Math.ceil(yMin / step) * step; v <= yMax + 1e-9; v += step) {
    yTicks.push(Math.round(v * 100) / 100);
  }

  const [hover, setHover] = useState<{ si: number; pi: number } | null>(null);

  return (
    <svg
      className={styles.svg}
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      style={{ maxWidth: width }}
      role="img"
      aria-label="분기별 생존율 추이 차트"
    >
      <text className={styles.axisTitle} x={0} y={12}>
        생존율(%)
      </text>

      {yTicks.map((t, i) => {
        const y = yAt(t);
        return (
          <g key={`yt-${i}`}>
            <line className={styles.grid} x1={padL} y1={y} x2={width - padR} y2={y} />
            <text className={styles.axisLabel} x={padL - 8} y={y} textAnchor="end" dominantBaseline="middle">
              {t.toFixed(tickDecimals)}
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
            y={height - padB + 16}
            textAnchor="middle"
          >
            {yearOf(label)}
          </text>
        );
      })}

      {series.map((s, si) => {
        const color = seriesColor(si);
        const coords = s.points
          .map((v, i) => (v == null ? null : { i, x: xAt(i), y: yAt(v) }))
          .filter((c): c is { i: number; x: number; y: number } => c !== null);
        if (coords.length === 0) return null;
        const path = coords.map((c) => `${c.x},${c.y}`).join(" ");
        return (
          <g key={`s-${si}`}>
            <polyline className={styles.line} points={path} stroke={color} />
            {coords.map((c) => (
              <g key={`p-${si}-${c.i}`}>
                <circle cx={c.x} cy={c.y} r={3} fill={color} />
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={9}
                  fill="transparent"
                  onMouseEnter={() => setHover({ si, pi: c.i })}
                  onMouseLeave={() => setHover(null)}
                />
              </g>
            ))}
          </g>
        );
      })}

      {hover &&
        (() => {
          const s = series[hover.si];
          const v = s.points[hover.pi];
          if (v == null) return null;
          const prev = hover.pi > 0 ? s.points[hover.pi - 1] : null;
          const delta = prev != null ? v - prev : null;

          const titleText = `${labels[hover.pi]} · ${s.name}`;
          const row2Text = `생존율 ${v.toFixed(1)}%`;
          const row3Text =
            delta == null
              ? "전분기 데이터 없음"
              : `전분기 대비 ${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%p`;

          const boxW = Math.max(
            128,
            estimateTextWidth(titleText) + 20,
            estimateTextWidth(row2Text) + 20,
            estimateTextWidth(row3Text) + 20,
          );
          const boxH = 54;
          const x = xAt(hover.pi);
          const y = yAt(v);
          const bx = Math.min(Math.max(x - boxW / 2, 2), width - boxW - 2);
          const by = y - boxH - 10 >= 0 ? y - boxH - 10 : y + 12;

          const rowH = boxH / 3;

          return (
            <g className={styles.tooltip} transform={`translate(${bx}, ${by})`}>
              <rect className={styles.tooltipBg} width={boxW} height={boxH} rx={8} />
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
