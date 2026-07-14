import { ExpandIcon } from "../landing/icons";
import styles from "./StatCards.module.css";

const WEEKEND_AVG_PCT = 28.4;

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

/** 외국인 비중 카드. pct는 foreign-ratio API 실데이터(생활인구 중 외국인 %). */
export function ForeignCard({ pct = null, onExpand }: { pct?: number | null; onExpand?: () => void }) {
  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <div>
          <h3 className={styles.title}>외국인</h3>
          <p className={styles.sub}>생활인구 중 외국인 비중</p>
        </div>
        {onExpand && (
          <button type="button" className={styles.expandBtn} onClick={onExpand} aria-label="외국인 확대">
            <ExpandIcon />
          </button>
        )}
      </div>
      <div className={styles.foreignRow}>
        <span className={styles.bigNum}>{pct != null ? `${pct}%` : "—"}</span>
        <div className={styles.miniEmpty}>지표없음</div>
      </div>
      <p className={styles.note}>서울 평균 지표없음</p>
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
            <ExpandIcon />
          </button>
        )}
      </div>
      <div className={styles.big}>
        <span className={styles.bigNum}>{manText}</span>
      </div>
      <p className={styles.note}>총매출 ÷ 유동인구</p>
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
            <ExpandIcon />
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
