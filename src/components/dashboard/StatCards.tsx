import styles from "./StatCards.module.css";

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
  // 실제 밴드 매출이 있으면 그 비율로 미니 막대, 없으면 정적 플레이스홀더 막대.
  const rawBars = bands ? bandKeys.map((k) => bands[k] ?? 0) : null;
  const maxBar = rawBars ? Math.max(...rawBars, 1) : 1;
  const bars = rawBars ? rawBars.map((v) => Math.round((v / maxBar) * 100)) : [12, 20, 100, 55, 40, 30];
  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <h3 className={styles.title}>밤 vs 낮 매출</h3>
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
      <div className={styles.miniBars}>
        {bars.map((h, i) => (
          <div key={slots[i]} className={styles.miniCol}>
            <span
              className={h >= 100 ? styles.miniBarTop : styles.miniBar}
              style={{ height: `${Math.max(10, h)}%` }}
            />
            <span className={styles.miniSlot}>{slots[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 외국인 비중 카드. pct는 foreign-ratio API 실데이터(생활인구 중 외국인 %). */
export function ForeignCard({ pct = null, onExpand }: { pct?: number | null; onExpand?: () => void }) {
  const bars = [30, 45, 55, 70, 85, 100];
  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <div>
          <h3 className={styles.title}>외국인 비중 ⓘ</h3>
          <p className={styles.sub}>생활인구 중 외국인 비중</p>
        </div>
        {onExpand && (
          <button type="button" className={styles.expandBtn} onClick={onExpand} aria-label="외국인 비중 확대">
            ⤢
          </button>
        )}
      </div>
      <div className={styles.foreignRow}>
        <span className={styles.bigNum}>{pct != null ? `${pct}%` : "—"}</span>
        <div className={styles.miniBars}>
          {bars.map((h, i) => (
            <div key={i} className={styles.miniCol}>
              <span
                className={h >= 100 ? styles.miniBarTop : styles.miniBar}
                style={{ height: `${h}%` }}
              />
            </div>
          ))}
        </div>
      </div>
      <p className={styles.note}>서울 평균 8.4%</p>
    </div>
  );
}

/** 인당 소비 카드(placeholder). */
export function PerCapitaCard({ manValue = 4.7, onExpand }: { manValue?: number; onExpand?: () => void }) {
  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <div>
          <h3 className={styles.title}>인당 소비 ⓘ</h3>
          <p className={styles.sub}>1회 평균 결제금액</p>
        </div>
        {onExpand && (
          <button type="button" className={styles.expandBtn} onClick={onExpand} aria-label="인당 소비 확대">
            ⤢
          </button>
        )}
      </div>
      <span className={styles.deltaTag}>+6% 전분기</span>
      <div className={styles.big}>
        <span className={styles.bigNum}>{manValue}만</span>
      </div>
      <p className={styles.note}>오피스형 평균 3.9만 · 상위 22%</p>
    </div>
  );
}

/** 주말 비중 카드. population-ratios API 실데이터(주말 유동인구 비중). */
export function WeekendCard({ pct = null, onExpand }: { pct?: number | null; onExpand?: () => void }) {
  const bars = [40, 50, 45, 60, 100, 70];
  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <div>
          <h3 className={styles.title}>주말 비중 ⓘ</h3>
          <p className={styles.sub}>유동인구 중 토·일 비중</p>
        </div>
        {onExpand && (
          <button type="button" className={styles.expandBtn} onClick={onExpand} aria-label="주말 비중 확대">
            ⤢
          </button>
        )}
      </div>
      <span className={styles.deltaTagBlue}>{pct != null && pct >= 28.6 ? "주말 집중" : "주중 우위"}</span>
      <div className={styles.weekendRow}>
        <span className={styles.bigNum}>{pct != null ? `${pct}%` : "—"}</span>
        <div className={styles.miniBars}>
          {bars.map((h, i) => (
            <div key={i} className={styles.miniCol}>
              <span
                className={h >= 100 ? styles.miniBarTop : styles.miniBar}
                style={{ height: `${h}%` }}
              />
            </div>
          ))}
        </div>
      </div>
      <p className={styles.note}>전체 상권 평균 28.4%</p>
    </div>
  );
}
