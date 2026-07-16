import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
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
  const [dragging, setDragging] = useState(false);
  /** 드래그 중 손잡이가 마우스를 그대로 따라가도록 쓰는 연속값(0~1). 프레임은 정수 스텝이라 별도로 둔다. */
  const [dragRatio, setDragRatio] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  /** 트랙 위 클라이언트 x좌표 → 0~1 비율. */
  const ratioFromClientX = (clientX: number): number => {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  };

  const updateFromClientX = (clientX: number) => {
    const ratio = ratioFromClientX(clientX);
    setDragRatio(ratio);
    if (periods.length > 1) setFrameIdx(Math.round(ratio * (periods.length - 1)));
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setPlaying(false);
    setDragging(true);
    updateFromClientX(e.clientX);
  };
  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    updateFromClientX(e.clientX);
  };
  const stopDragging = () => {
    setDragging(false);
    setDragRatio(null);
  };

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

      <div
        ref={trackRef}
        className={[styles.scrubber, dragging ? styles.scrubberDragging : ""].join(" ")}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
      >
        <div className={styles.scrubberTrack} />
        {periods.map((p, i) => (
          <button
            key={p}
            type="button"
            className={styles.dot}
            aria-label={p}
            aria-current={i === frameIdx}
            onClick={() => {
              setPlaying(false);
              setFrameIdx(i);
            }}
          />
        ))}
        <div
          className={[styles.thumb, dragging ? styles.thumbDragging : ""].join(" ")}
          style={{
            left: `${(periods.length > 1 ? (dragRatio ?? frameIdx / (periods.length - 1)) : 0) * 100}%`,
          }}
        />
      </div>
    </div>
  );
}
