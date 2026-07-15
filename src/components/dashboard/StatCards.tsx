import ForeignDonut from "./ForeignDonut";
import styles from "./StatCards.module.css";

const WEEKEND_AVG_PCT = 28.4;

/** 인원수를 한국식으로 축약(예: 12716 → "1.3만 명", 8200 → "8,200명"). */
function formatCountKo(n: number): string {
  const v = Math.round(n);
  if (v >= 10000) return `${(v / 10000).toFixed(1)}만 명`;
  return `${v.toLocaleString("ko-KR")}명`;
}

/** 낮 vs 밤 매출 카드. sales-time-bands API 실데이터(낮=06~17, 밤=17~06). */
export function DayNightCard({
  dayPct = null,
  nightPct = null,
  bands = null,
}: {
  dayPct?: number | null;
  nightPct?: number | null;
  bands?: Record<string, number> | null;
}) {
  const slots = ["00~06", "06~11", "11~14", "14~17", "17~21", "21~24"];
  const bandKeys = ["00_06", "06_11", "11_14", "14_17", "17_21", "21_24"];
  const hasData = dayPct != null && nightPct != null;
  // 실제 밴드 매출이 있으면 그 비율로 미니 막대, 없으면 지표없음.
  const rawBars = bands ? bandKeys.map((k) => bands[k] ?? 0) : null;
  const maxBar = rawBars ? Math.max(...rawBars, 1) : 1;
  const bars = rawBars ? rawBars.map((v) => Math.round((v / maxBar) * 100)) : null;
  const total = rawBars ? rawBars.reduce((a, b) => a + b, 0) || 1 : 1;
  const barPcts = rawBars ? rawBars.map((v) => Math.round((v / total) * 100)) : null;
  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <h3 className={styles.title}>낮 vs 밤 매출</h3>
        <p className={styles.sub}>시간대 매출 구성</p>
      </div>
      <div className={styles.dnHero}>
        <span className={styles.dnBig}>낮 {hasData ? `${dayPct}%` : "—"}</span>
        <span className={styles.dnBig}>밤 {hasData ? `${nightPct}%` : "—"}</span>
      </div>
      <div className={styles.dnBar}>
        <span className={styles.dnFill} style={{ width: `${hasData ? dayPct : 50}%` }} />
      </div>
      <div className={styles.dnLegend}>
        <span>낮 {hasData ? `${dayPct}%` : "—"}</span>
        <span>밤 {hasData ? `${nightPct}%` : "—"}</span>
      </div>
      <p className={styles.miniLabel}>시간대별 매출 구성</p>
      {bars ? (
        <div className={styles.miniBars}>
          {bars.map((h, i) => (
            <div key={slots[i]} className={styles.miniCol}>
              <span className={styles.miniVal}>{barPcts![i]}%</span>
              <span
                className={h >= 100 ? styles.miniBarTop : styles.miniBar}
                style={{ height: `${Math.max(10, h)}%` }}
              />
              <span className={styles.miniSlot}>{slots[i]}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.miniEmpty}>지표없음</div>
      )}
    </div>
  );
}

/** 시간대 유동인구를 부드러운 area/line 경로로(viewBox 0 0 100 40). Catmull-Rom→베지어 스무딩. */
function buildRhythmPath(vals: number[]) {
  const W = 100, H = 40, padT = 5, padB = 4;
  const max = Math.max(...vals, 1);
  const n = vals.length;
  const pts = vals.map((v, i) => ({
    x: n > 1 ? (i / (n - 1)) * W : W / 2,
    y: H - padB - (v / max) * (H - padT - padB),
  }));
  let line = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    line += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  const area = `${line} L ${W} ${H} L 0 ${H} Z`;
  const peakIdx = vals.reduce((best, v, i) => (v > vals[best] ? i : best), 0);
  return { line, area, pts, peakIdx };
}

/**
 * 유동인구 리듬 카드. 시간대별 유동인구를 물결(area) 스파크라인으로 그려 "언제 붐비나"를 보여준다.
 * peakLabel = by_time 최댓값 시간대, byTime = 시간대별 유동인구, day/nightPct = 낮/밤 비중.
 */
export function PopulationRhythmCard({
  peakLabel = null,
  dayPct = null,
  nightPct = null,
  byTime = null,
}: {
  peakLabel?: string | null;
  dayPct?: number | null;
  nightPct?: number | null;
  byTime?: { slot: string; avg_population: number | null }[] | null;
}) {
  const hasDN = dayPct != null && nightPct != null;
  const slots = byTime && byTime.length > 1 ? byTime : null;
  const wave = slots ? buildRhythmPath(slots.map((s) => s.avg_population ?? 0)) : null;
  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <div>
          <h3 className={styles.title}>유동인구 리듬</h3>
          <p className={styles.sub}>언제 붐비나</p>
        </div>
      </div>
      <p className={styles.miniLabel}>가장 붐비는 시간</p>
      <div className={styles.bigNum}>{peakLabel ?? "—"}</div>

      {wave && slots ? (
        <>
          <div className={styles.rhythmWrap}>
            <svg className={styles.rhythmSvg} viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden>
              <defs>
                <linearGradient id="rhythmGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <path d={wave.area} fill="url(#rhythmGrad)" />
              <path
                d={wave.line}
                fill="none"
                stroke="var(--color-primary)"
                strokeWidth="1.6"
                vectorEffect="non-scaling-stroke"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span
              className={styles.rhythmPeak}
              style={{
                left: `${wave.pts[wave.peakIdx].x}%`,
                top: `${(wave.pts[wave.peakIdx].y / 40) * 100}%`,
              }}
            />
          </div>
          <div className={styles.rhythmLabels}>
            {slots.map((s, i) => (
              <span key={s.slot} className={i === wave.peakIdx ? styles.rhythmLabelPeak : ""}>
                {s.slot.split("~")[0]}
              </span>
            ))}
          </div>
        </>
      ) : (
        <div className={styles.miniEmpty}>지표없음</div>
      )}

      {hasDN && <p className={styles.rhythmDN}>낮 {dayPct}% · 밤 {nightPct}%</p>}
    </div>
  );
}

/** 외국인 비중 카드. pct/count/total은 foreign-ratio API 실데이터(생활인구 중 외국인). */
export function ForeignCard({
  pct = null,
  count = null,
  total = null,
  onExpand,
}: {
  pct?: number | null;
  count?: number | null;
  total?: number | null;
  onExpand?: () => void;
}) {
  const countLabel = count != null ? `약 ${formatCountKo(count)}` : null;
  const note = total != null ? `생활인구 ${formatCountKo(total)} 기준` : "생활인구 대비 비율";
  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <div>
          <h3 className={styles.title}>외국인</h3>
          <p className={styles.sub}>생활인구 중 외국인 비중</p>
        </div>
        {onExpand && (
          <button type="button" className={styles.expandBtn} onClick={onExpand} aria-label="외국인 확대">
            ⤢
          </button>
        )}
      </div>
      <div className={styles.foreignRow}>
        {pct != null ? (
          <div className={styles.foreignDonutMini}>
            <ForeignDonut pct={pct} size={120} compact />
          </div>
        ) : (
          <span className={styles.bigNum}>—</span>
        )}
      </div>
      <div className={styles.foreignBottom}>
        <p className={styles.note}>{note}</p>
        {countLabel && <span className={styles.foreignCount}>{countLabel}</span>}
      </div>
    </div>
  );
}

/** 인당 소비 카드(placeholder). */
export function PerCapitaCard({ wonValue = null, onExpand }: { wonValue?: number | null; onExpand?: () => void }) {
  // 인당매출(원) → ₩ + 천단위 콤마(예: ₩56,178). 데이터 없으면 "—".
  const manText = wonValue != null ? `₩${Math.round(wonValue).toLocaleString("ko-KR")}` : "—";
  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <div>
          <h3 className={styles.title}>인당 소비</h3>
          <p className={styles.sub}>방문 1인당 매출(분기)</p>
        </div>
        {onExpand && (
          <button type="button" className={styles.expandBtn} onClick={onExpand} aria-label="인당 소비 확대">
            ⤢
          </button>
        )}
      </div>
      <div className={styles.big}>
        <span className={styles.bigNum}>{manText}</span>
      </div>
      <p className={`${styles.note} ${styles.noteBottomRight}`}>총매출 ÷ 유동인구</p>
    </div>
  );
}

/** 주말 비중 카드. pct=population-ratios 실데이터, 미니막대=heatmap by_day(요일별 유동인구) 실데이터. */
export function WeekendCard({
  pct = null,
  days = null,
  onExpand,
}: {
  pct?: number | null;
  days?: { slot: string; avg_population: number | null }[] | null;
  onExpand?: () => void;
}) {
  // 요일별 유동인구를 최댓값 대비 비율(%) 막대로. 데이터 없으면 지표없음.
  const vals = days && days.length > 0 ? days.map((d) => d.avg_population ?? 0) : null;
  const maxBar = vals ? Math.max(...vals, 1) : 1;
  const bars = vals ? vals.map((v) => Math.round((v / maxBar) * 100)) : null;
  const totalPop = vals ? vals.reduce((a, b) => a + b, 0) || 1 : 1;
  const barPcts = vals ? vals.map((v) => Math.round((v / totalPop) * 100)) : null;
  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <div>
          <h3 className={styles.title}>요일별 매출</h3>
          <p className={styles.sub}>유동인구 중 토·일 비중</p>
        </div>
        {onExpand && (
          <button type="button" className={styles.expandBtn} onClick={onExpand} aria-label="요일별 매출 확대">
            ⤢
          </button>
        )}
      </div>
      {pct != null && (
        <span className={styles.deltaTagBlue}>{pct >= WEEKEND_AVG_PCT ? "주말 집중" : "주중 우위"}</span>
      )}
      <div className={styles.weekendRow}>
        <span className={styles.bigNum}>{pct != null ? `${pct}%` : "—"}</span>
        {bars ? (
          <div className={styles.miniBars}>
            {bars.map((h, i) => (
              <div key={days![i].slot} className={styles.miniCol}>
                <span className={styles.miniVal}>{barPcts![i]}%</span>
                <span
                  className={h >= 100 ? styles.miniBarTop : styles.miniBar}
                  style={{ height: `${Math.max(10, h)}%` }}
                />
                <span className={styles.miniSlot}>{days![i].slot}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.miniEmpty}>지표없음</div>
        )}
      </div>
      <p className={styles.note}>전체 상권 평균 {WEEKEND_AVG_PCT}%</p>
    </div>
  );
}
