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

/** 시각(0~24h)을 시계 각도 좌표로. 0h=위(12시 방향), 시계방향. */
function clockPoint(cx: number, cy: number, r: number, hour: number): [number, number] {
  const a = (-90 + (hour / 24) * 360) * (Math.PI / 180);
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

/** 시간대 유동인구를 24시간 시계형 로즈(부채꼴 반지름=유동인구)로. viewBox 0 0 120 120. */
function buildClock(slots: { slot: string; avg_population: number | null }[]) {
  const C = 60, RMAX = 50, RMIN = 16;
  const vals = slots.map((s) => s.avg_population ?? 0);
  const max = Math.max(...vals, 1);
  const peakIdx = vals.reduce((best, v, i) => (v > vals[best] ? i : best), 0);
  const sectors = slots.map((s, i) => {
    const [a, b] = s.slot.split("~");
    const h0 = Number(a);
    const h1 = Number(b) === 0 ? 24 : Number(b);
    const r = RMIN + (vals[i] / max) * (RMAX - RMIN);
    const [x0, y0] = clockPoint(C, C, r, h0);
    const [x1, y1] = clockPoint(C, C, r, h1);
    const large = ((h1 - h0) / 24) * 360 > 180 ? 1 : 0;
    const d = `M ${C} ${C} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
    return { d, isPeak: i === peakIdx, slot: s.slot };
  });
  return { sectors, peakIdx };
}

const CLOCK_TICKS = [0, 6, 12, 18];

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
  const clock = slots ? buildClock(slots) : null;
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

      {clock ? (
        <div className={styles.clockWrap}>
          <svg viewBox="0 0 120 120" className={styles.clockSvg} aria-hidden>
            <circle cx="60" cy="60" r="51" className={styles.clockRing} />
            <circle cx="60" cy="60" r="16" className={styles.clockRing} />
            {clock.sectors.map((s) => (
              <path key={s.slot} d={s.d} className={s.isPeak ? styles.clockWedgePeak : styles.clockWedge} />
            ))}
            {CLOCK_TICKS.map((h) => {
              const [tx, ty] = clockPoint(60, 60, 58, h);
              return (
                <text key={h} x={tx} y={ty} className={styles.clockTick}>
                  {h}
                </text>
              );
            })}
          </svg>
        </div>
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
