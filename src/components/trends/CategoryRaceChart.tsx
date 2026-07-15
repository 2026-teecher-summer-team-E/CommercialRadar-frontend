import { useEffect, useMemo, useRef, useState } from "react";
import type { PopularityHistorySeries } from "../../types";
import styles from "./CategoryRaceChart.module.css";

interface Props {
  periods: string[];
  series: PopularityHistorySeries[];
}

const FRAME_MS = 1600;
const ROW_H = 40;
/** 앱 전역 시리즈 색 토큰(--series-1~7) — 팔레트 크기를 넘지 않게 컴포넌트 상위에서 limit=7로 맞춘다. */
const SERIES_COLOR_VARS = [
  "--series-1",
  "--series-2",
  "--series-3",
  "--series-4",
  "--series-5",
  "--series-6",
  "--series-7",
];

export default function CategoryRaceChart({ periods, series }: Props) {
  const [frameIdx, setFrameIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setFrameIdx(0);
  }, [periods.length]);

  useEffect(() => {
    if (!playing || periods.length <= 1) return;
    timerRef.current = setInterval(() => {
      setFrameIdx((i) => (i + 1) % periods.length);
    }, FRAME_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [playing, periods.length]);

  const colorOf = useMemo(() => {
    const map = new Map<string, string>();
    series.forEach((s, i) => map.set(s.category_name, `var(${SERIES_COLOR_VARS[i % SERIES_COLOR_VARS.length]})`));
    return map;
  }, [series]);

  if (periods.length === 0 || series.length === 0) {
    return <div className={styles.empty}>추이 데이터가 아직 집계되지 않았습니다.</div>;
  }

  const period = periods[frameIdx];
  const frameValues = series.map((s) => ({
    category_name: s.category_name,
    value: s.values.find((v) => v.period === period)?.popularity_index ?? 0,
  }));
  const ranked = [...frameValues].sort((a, b) => b.value - a.value);
  const rankOf = new Map(ranked.map((r, i) => [r.category_name, i]));
  const maxValue = Math.max(...frameValues.map((f) => f.value), 1);

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <span className={styles.period}>{period}</span>
        <button
          type="button"
          className={styles.playBtn}
          onClick={() => setPlaying((p) => !p)}
          aria-pressed={playing}
        >
          {playing ? "일시정지" : "재생"}
        </button>
      </div>

      <div className={styles.chart} style={{ height: series.length * ROW_H }}>
        {frameValues.map((item) => {
          const rank = rankOf.get(item.category_name) ?? 0;
          const widthPct = Math.max(3, (item.value / maxValue) * 100);
          return (
            <div
              key={item.category_name}
              className={styles.row}
              style={{ transform: `translateY(${rank * ROW_H}px)`, height: ROW_H }}
            >
              <span className={styles.rowLabel}>{item.category_name}</span>
              <div className={styles.barTrack}>
                <div
                  className={styles.bar}
                  style={{ width: `${widthPct}%`, background: colorOf.get(item.category_name) }}
                />
              </div>
              <span className={styles.rowValue}>{item.value.toFixed(1)}</span>
            </div>
          );
        })}
      </div>

      <div className={styles.scrubber}>
        {periods.map((p, i) => (
          <button
            key={p}
            type="button"
            className={i === frameIdx ? styles.dotActive : styles.dot}
            aria-label={p}
            aria-current={i === frameIdx}
            onClick={() => {
              setPlaying(false);
              setFrameIdx(i);
            }}
          />
        ))}
      </div>
    </div>
  );
}
