import { useMemo } from "react";
import type { HeatmapSlot } from "../../types";
import { fmtInt, fmtManUnit } from "./format";
import styles from "./PopulationHeatmap.module.css";

/**
 * 지도 페이지(SangkwonPanel) 혼잡도 히트맵과 동일한 4단계 이산 색상.
 * color-mix 연속 보간은 --color-primary-light(거의 흰색)와의 저채도 구간에서
 * 값 차이가 잘 안 보였다 — 명도 차이가 뚜렷한 이산 단계로 바꿔 구분되게 한다.
 */
const HEAT_COLORS = ["#eef1f8", "#aabfec", "#7592e0", "#24398a"] as const;

/** 지도 페이지 congestionLevel과 동일한 구간 기준(0~1 정규화 강도 → 0~3단계). */
function heatColor(t: number): string {
  if (t >= 0.85) return HEAT_COLORS[3];
  if (t >= 0.65) return HEAT_COLORS[2];
  if (t >= 0.4) return HEAT_COLORS[1];
  return HEAT_COLORS[0];
}

/**
 * 셀 표시용 숫자. 인라인은 분기 누적 기준 만 단위(소수점 없이 반올림) — 유동인구가 작은
 * 상권(예: 분기 총량이 1만 명대)은 셀 하나가 만 단위 미만이라 반올림하면 전부 "0만명"이
 * 되므로 fmtManUnit처럼 1만 미만은 원래 수치를 그대로 보여준다.
 * 모달 확대(wide)는 "상세" 화면이니 반올림 없이 정확한 수치를 그대로 보여준다.
 */
function fmtCellMan(value: number, wide: boolean): string {
  if (wide) return `${fmtInt(value)}명`;
  return `${fmtManUnit(value, 0)}명`;
}

interface PopulationHeatmapProps {
  byTime: HeatmapSlot[];
  byDay: HeatmapSlot[];
  /** true면 셀에 값을 함께 표시. */
  showValues?: boolean;
  /** true면 셀 폭을 꽉 채움(모달 확대용). 인라인은 항상 폭 제한 유지. */
  wide?: boolean;
}

/** Figma 순서 그대로. 데이터에 없는 slot 은 비운다. */
const DAY_ORDER = ["월", "화", "수", "목", "금", "토", "일"];
const TIME_ORDER = ["00~06", "06~11", "11~14", "14~17", "17~21", "21~24"];
/** 세로축 표기(Figma 는 하이픈). slot 키는 물결(~)이라 별도 라벨 매핑. */
const TIME_LABEL: Record<string, string> = {
  "00~06": "00-06",
  "06~11": "06-11",
  "11~14": "11-14",
  "14~17": "14-17",
  "17~21": "17-21",
  "21~24": "21-24",
};

/**
 * 시간대·요일 주변분포(marginal)를 2D 그리드로 근사한다.
 * 각 셀 강도 = (시간대 비율) × (요일 비율), 전체 최댓값으로 0~1 정규화.
 * (지도 페이지 buildCongestionGrid 와 동일 아이디어의 자체 구현.)
 */
export default function PopulationHeatmap({ byTime, byDay, showValues = false, wide = false }: PopulationHeatmapProps) {
  const timeMap = useMemo(
    () => new Map(byTime.map((s) => [s.slot, s.avg_population ?? 0])),
    [byTime],
  );
  const dayMap = useMemo(
    () => new Map(byDay.map((s) => [s.slot, s.avg_population ?? 0])),
    [byDay],
  );

  const grid = useMemo(() => {
    const timeSum = TIME_ORDER.reduce((a, t) => a + (timeMap.get(t) ?? 0), 0) || 1;
    const daySum = DAY_ORDER.reduce((a, d) => a + (dayMap.get(d) ?? 0), 0) || 1;
    const rows = TIME_ORDER.map((t) => {
      const tw = (timeMap.get(t) ?? 0) / timeSum;
      return DAY_ORDER.map((d) => {
        const dw = (dayMap.get(d) ?? 0) / daySum;
        // 근사 절대값(분기 누적 기준): 시간대 유동량(분기 누적) × 요일 비율 × 7.
        // 페이지 전체를 분기 누적 단위로 통일하므로 하루 평균 환산 없이 그대로 쓴다.
        const value = (timeMap.get(t) ?? 0) * dw * DAY_ORDER.length;
        return { time: t, day: d, weight: tw * dw, value };
      });
    });
    return rows;
  }, [timeMap, dayMap]);

  const maxWeight = useMemo(() => {
    let m = 0;
    grid.forEach((row) => row.forEach((c) => (m = Math.max(m, c.weight))));
    return m || 1;
  }, [grid]);

  const hasData = byTime.length > 0 && byDay.length > 0;
  if (!hasData) {
    return <div className={styles.empty}>유동인구 데이터가 없어요.</div>;
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.topSpacer} />
      {/* 인라인은 셀 최대폭 제한(와이드 화면에서 긴 막대처럼 늘어지지 않게), 모달(wide)은 꽉 채움. */}
      <div
        className={styles.grid}
        style={{ gridTemplateColumns: `48px repeat(${DAY_ORDER.length}, ${wide ? "minmax(0, 1fr)" : "minmax(0, 120px)"})` }}
      >
        {/* 헤더 행: 요일 */}
        <span className={styles.corner} />
        {DAY_ORDER.map((d) => (
          <span key={d} className={styles.colHead}>
            {d}
          </span>
        ))}
        {/* 데이터 행 */}
        {grid.map((row, ri) => (
          <Row key={TIME_ORDER[ri]} time={TIME_ORDER[ri]} row={row} maxWeight={maxWeight} showValues={showValues} wide={wide} />
        ))}
      </div>
      <div className={styles.bottomSpacer} />
      {!wide && (
        <div className={styles.legend}>
          <span className={styles.legendLabel}>낮음</span>
          {HEAT_COLORS.map((c) => (
            <span key={c} className={styles.legendCell} style={{ backgroundColor: c }} />
          ))}
          <span className={styles.legendLabel}>높음</span>
        </div>
      )}
    </div>
  );
}

function Row({
  time,
  row,
  maxWeight,
  showValues,
  wide,
}: {
  time: string;
  row: Array<{ time: string; day: string; weight: number; value: number }>;
  maxWeight: number;
  showValues: boolean;
  wide: boolean;
}) {
  return (
    <>
      <span className={styles.rowHead}>{TIME_LABEL[time] ?? time}</span>
      {row.map((c) => {
        const t = Math.max(0, Math.min(1, c.weight / maxWeight));
        return (
          <div
            key={c.day}
            className={styles.cell}
            style={{ backgroundColor: heatColor(t) }}
            title={`${c.day} ${TIME_LABEL[time] ?? time}: ${fmtInt(c.value)}`}
          >
            {showValues && (
              <span className={styles.cellVal} style={{ color: t >= 0.65 ? "var(--color-on-primary)" : "var(--color-text-body)" }}>
                {fmtCellMan(c.value, wide)}
              </span>
            )}
          </div>
        );
      })}
    </>
  );
}
