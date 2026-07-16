import { DAYS_PER_QUARTER } from "./format";
import styles from "./StatCards.module.css";

// 전체 상권 총매출 ÷ 전체 상권 유동인구(가중평균). 인당매출은 유동인구가 극히 적은
// 일부 상권에서 이상치가 커서(예: 유동인구 8명) 단순 평균 대신 이 값을 쓴다.
const PER_CAPITA_AVG_WON = 18693;
// 서울 상권 1,622개 각각의 "외국인 ÷ 전체 유동인구" 비율을 단순 평균한 값(DB 실계산, %).
const FOREIGN_AVG_PCT = 5.5;
// foreign_population은 최근 14일 표본 평균이라, 페이지 전체 기준인 분기 누적과 맞추려면
// 하루 평균에 분기 일수를 곱한 값으로 환산한다(14일 평균이 분기 내내 유지된다고 가정한
// 추정치). count/total에만 적용 — pct는 비율이라 스케일에 영향받지 않는다.
const QUARTERLY_SCALE_FROM_14D = DAYS_PER_QUARTER / 14;

/** 인원수를 한국식으로 축약(예: 12716 → "1.3만 명", 8200 → "8,200명"). */
function formatCountKo(n: number): string {
  const v = Math.round(n);
  if (v >= 10000) return `${(v / 10000).toFixed(1)}만 명`;
  return `${v.toLocaleString("ko-KR")}명`;
}

/**
 * 미니 막대 그룹 계산. 라벨(전체 합 대비 %)과 막대 높이(최댓값 대비 %)를 같은 pct 값
 * 하나에서 파생시켜, 라벨이 같으면 높이도 항상 같도록 보장한다.
 * (예전엔 라벨=합계 기준, 높이=최댓값 기준을 각각 반올림해서 같은 라벨인데 높이가
 * 미묘하게 달라 보이는 문제가 있었다.)
 */
function buildMiniBars(vals: number[]): { pct: number; heightPct: number; isMax: boolean }[] {
  const total = vals.reduce((a, b) => a + b, 0) || 1;
  const pcts = vals.map((v) => Math.round((v / total) * 100));
  const maxPct = Math.max(...pcts, 1);
  return pcts.map((pct) => ({
    pct,
    heightPct: Math.max(10, Math.round((pct / maxPct) * 100)),
    isMax: pct === maxPct,
  }));
}

/**
 * 1위 + 공동 2위(있으면)에 해당하는 요일들을 원래 순서(월~일) 그대로 묶는다.
 * 예: 금 17%가 1위, 화·수·목이 16%로 공동 2위면 → "화, 수, 목, 금" · 합계 65%.
 */
function topTierDays(
  bars: { pct: number }[],
  slots: string[],
): { label: string; pct: number; idxs: Set<number> } | null {
  if (bars.length === 0) return null;
  const uniqueDesc = [...new Set(bars.map((b) => b.pct))].sort((a, b) => b - a);
  const [tier1, tier2] = uniqueDesc;
  const idxs = bars
    .map((_, i) => i)
    .filter((i) => bars[i].pct === tier1 || (tier2 !== undefined && bars[i].pct === tier2));
  return {
    label: idxs.map((i) => slots[i]).join(", "),
    pct: idxs.reduce((s, i) => s + bars[i].pct, 0),
    idxs: new Set(idxs),
  };
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
  const bars = rawBars ? buildMiniBars(rawBars) : null;
  const dayIsBigger = hasData && (dayPct as number) >= (nightPct as number);
  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <h3 className={styles.title}>주·야간 매출 비중</h3>
      </div>
      <div className={styles.dnHero}>
        <span className={dayIsBigger ? styles.dnBig : styles.dnBigMuted}>주간 {hasData ? `${dayPct}%` : "—"}</span>
        <span className={dayIsBigger ? styles.dnBigMuted : styles.dnBig}>{hasData ? `${nightPct}%` : "—"} 야간</span>
      </div>
      <div className={styles.dnBar}>
        <span
          className={dayIsBigger ? styles.dnFillDark : styles.dnFillLight}
          style={{ width: `${hasData ? dayPct : 50}%` }}
        />
        <span
          className={dayIsBigger ? styles.dnFillLight : styles.dnFillDark}
          style={{ width: `${hasData ? nightPct : 50}%` }}
        />
      </div>
      <p className={`${styles.miniLabel} ${styles.dnBarsLabel}`}>시간대별 매출 구성</p>
      {bars ? (
        <div className={`${styles.miniBars} ${styles.dnMiniBars}`}>
          {bars.map((b, i) => (
            <div key={slots[i]} className={styles.miniCol}>
              <div className={styles.miniTrack}>
                <div className={styles.miniBarWrap} style={{ height: `${b.heightPct}%` }}>
                  <span className={styles.miniVal}>{b.pct}%</span>
                  <span className={b.isMax ? styles.miniBarTop : styles.miniBar} />
                </div>
              </div>
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

/**
 * 유동인구 리듬 카드. 시간·요일 히트맵 옆에 배치해 "언제 붐비나"를 요약한다.
 * peakLabel = heatmap by_time 최댓값 시간대, day/nightPct = population-ratios 유동인구 낮/밤 비중(매출 아님).
 */
export function PopulationRhythmCard({
  peakLabel = null,
  peakDayLabel = null,
  dayPct = null,
  nightPct = null,
}: {
  peakLabel?: string | null;
  peakDayLabel?: string | null;
  dayPct?: number | null;
  nightPct?: number | null;
}) {
  const hasDN = dayPct != null && nightPct != null;
  const dayIsBigger = hasDN && (dayPct as number) >= (nightPct as number);
  return (
    <div className={styles.card}>
      <div className={styles.rhythmBody}>
        <div>
          <p className={`${styles.title} ${styles.rhythmDnTitle}`}>주간 vs 야간 유동인구</p>
          <div className={styles.dnHero}>
            <span className={dayIsBigger ? styles.dnBig : styles.dnBigMuted}>
              주간 {hasDN ? `${dayPct}%` : "—"}
            </span>
            <span className={dayIsBigger ? styles.dnBigMuted : styles.dnBig}>
              {hasDN ? `${nightPct}%` : "—"} 야간
            </span>
          </div>
          <div className={styles.dnBar}>
            <span
              className={dayIsBigger ? styles.dnFillDark : styles.dnFillLight}
              style={{ width: `${hasDN ? dayPct : 50}%` }}
            />
            <span
              className={dayIsBigger ? styles.dnFillLight : styles.dnFillDark}
              style={{ width: `${hasDN ? nightPct : 50}%` }}
            />
          </div>
        </div>
        <div className={styles.rhythmPeakGrid}>
          <div>
            <p className={styles.title}>가장 붐비는 요일</p>
            <div className={styles.rhythmPeakValue}>{peakDayLabel ?? "—"}</div>
          </div>
          <div>
            <p className={styles.title}>가장 붐비는 시간</p>
            <div className={styles.rhythmPeakValue}>{peakLabel ?? "—"}</div>
          </div>
        </div>
      </div>
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
  // count/total은 원본이 14일 평균이라 분기 누적 기준으로 환산(추정치)한다.
  const countQ = count != null ? count * QUARTERLY_SCALE_FROM_14D : null;
  const totalQ = total != null ? total * QUARTERLY_SCALE_FROM_14D : null;
  const countLabel = countQ != null ? `외국인 약 ${formatCountKo(countQ)}` : null;
  const note = totalQ != null ? `유동인구 ${formatCountKo(totalQ)} 기준` : "유동인구 대비 비율";
  const hasPct = pct != null;
  const domesticPct = hasPct ? Math.round((100 - pct) * 10) / 10 : null;

  // 도넛 arc: r=40인 원 둘레(2πr)를 외국인 비중만큼 채우고 나머지는 트랙 색으로 남긴다.
  const r = 40;
  const circumference = 2 * Math.PI * r;
  const filled = hasPct ? (pct / 100) * circumference : 0;

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <div>
          <h3 className={styles.title}>외국인</h3>
          <p className={styles.sub}>유동인구 중 외국인 비중</p>
        </div>
        {onExpand && (
          <button type="button" className={styles.expandBtn} onClick={onExpand} aria-label="외국인 확대">
            ⤢
          </button>
        )}
      </div>
      <div className={styles.foreignRow}>
        <div className={styles.foreignLegend}>
          <span className={styles.legendRow}>
            <i className={styles.legendDotFill} /> 외국인 {hasPct ? `${pct}%` : "—"}
          </span>
          <span className={styles.legendRow}>
            <i className={styles.legendDotTrack} /> 내국인 {hasPct ? `${domesticPct}%` : "—"}
          </span>
          {countLabel && <span className={styles.foreignCount}>{countLabel}</span>}
        </div>
      </div>
      <div className={styles.donutWrap}>
        <svg viewBox="0 0 100 100" className={styles.donut} role="img" aria-label={hasPct ? `외국인 ${pct}%, 내국인 ${domesticPct}%` : "데이터 없음"}>
          <circle cx="50" cy="50" r={r} className={styles.donutTrack}>
            {hasPct && <title>내국인 {domesticPct}%</title>}
          </circle>
          {hasPct && (
            <circle
              cx="50"
              cy="50"
              r={r}
              className={styles.donutFill}
              strokeDasharray={`${filled} ${circumference}`}
            >
              <title>{countLabel ? `${countLabel} (${pct}%)` : `외국인 ${pct}%`}</title>
            </circle>
          )}
        </svg>
        <div className={styles.donutCenter}>
          <span className={styles.bigNum}>{hasPct ? `${pct}%` : "—"}</span>
        </div>
      </div>
      <div className={`${styles.foreignNote} ${styles.foreignNoteRow}`}>
        <span className={styles.note} title="최근 14일 평균 표본을 분기 누적 기준으로 환산한 추정치">
          {note}
        </span>
        <span className={styles.note}>전체 상권 평균 {FOREIGN_AVG_PCT}%</span>
      </div>
    </div>
  );
}

/** 인당 소비 카드(placeholder). */
export function PerCapitaCard({ wonValue = null, onExpand }: { wonValue?: number | null; onExpand?: () => void }) {
  // 인당매출(원) → ₩ + 천단위 콤마(예: ₩56,178). 데이터 없으면 "—".
  const manText = wonValue != null ? `₩${Math.round(wonValue).toLocaleString("ko-KR")}` : "—";
  const avgText = `₩${PER_CAPITA_AVG_WON.toLocaleString("ko-KR")}`;

  // 반원 게이지(안이 찬 파이 형태): 이 상권 값과 전체 평균을 같은 스케일(0~scaleMax) 위에 함께 표시.
  // scaleMax는 둘 중 큰 값에 여유(1.2배)를 둬서 게이지가 꽉 차 보이지 않게 한다.
  const r = 40;
  const scaleMax = Math.max(wonValue ?? 0, PER_CAPITA_AVG_WON, 1) * 1.2;
  const valueFrac = wonValue != null ? Math.min(1, Math.max(0, wonValue / scaleMax)) : 0;
  const avgFrac = Math.min(1, PER_CAPITA_AVG_WON / scaleMax);
  // 반원 위의 각도(라디안): 0=왼쪽 끝(180°) → 1=오른쪽 끝(0°), 위로 볼록.
  const angleAt = (frac: number) => Math.PI - frac * Math.PI;
  const pointAt = (frac: number, radius: number) => {
    const a = angleAt(frac);
    return { x: 50 + radius * Math.cos(a), y: 50 - radius * Math.sin(a) };
  };
  const wedgePath = (fromFrac: number, toFrac: number) => {
    const p0 = pointAt(fromFrac, r);
    const p1 = pointAt(toFrac, r);
    return `M 50 50 L ${p0.x} ${p0.y} A ${r} ${r} 0 0 1 ${p1.x} ${p1.y} Z`;
  };
  // 평균 마커: 파이를 가로질러야 "중간을 끊어주는" 느낌이 나서, 중심 가까이(4)부터
  // 바깥 테두리(r)까지 관통하는 막대로 그린다.
  const avgP0 = pointAt(avgFrac, 4);
  const avgP1 = pointAt(avgFrac, r);
  const avgLabelPoint = pointAt(avgFrac, r + 10);
  // 스케일 최대치 라벨. 그래프 우측 아래(frac=1, 오른쪽 끝) 근처에 둔다. 각도상 y가
  // 고정(항상 baseline)이라 반지름을 늘려도 아래로는 못 뜨므로, 같은 x축 지점에서
  // px 단위로 살짝 아래에 띄워 호와 겹치지 않으면서도 그래프에 바짝 붙게 한다.
  const maxLabelPoint = pointAt(1, r);

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <div>
          <h3 className={styles.title}>인당 소비</h3>
          <p className={styles.sub}>총매출 ÷ 유동인구</p>
        </div>
        <div className={styles.weekendHeadRightNum}>
          {wonValue != null && (
            <span className={`${styles.deltaTagBlue} ${styles.weekendTagInline}`}>
              {wonValue >= PER_CAPITA_AVG_WON ? "평균 이상" : "평균 이하"}
            </span>
          )}
          {onExpand && (
            <button type="button" className={styles.expandBtn} onClick={onExpand} aria-label="인당 소비 확대">
              ⤢
            </button>
          )}
        </div>
      </div>
      <div className={styles.perCapitaRow}>
        <div className={styles.perCapitaBigWrap}>
          <div className={styles.big}>
            <span className={styles.bigNum}>{manText}</span>
          </div>
        </div>
        <div className={styles.gaugeWrap}>
          <svg viewBox="0 0 100 54" className={styles.gauge} role="img" aria-label={`이 상권 ${manText}, 전체 평균 ${avgText}`}>
            <path d={wedgePath(0, 1)} className={styles.gaugeTrack} />
            {wonValue != null && <path d={wedgePath(0, valueFrac)} className={styles.gaugeFill} />}
            {/* 흰 선 + 진한 파랑 테두리: 두꺼운 파랑 선 위에 얇은 흰 선을 겹쳐서 표현한다. */}
            <line x1={avgP0.x} y1={avgP0.y} x2={avgP1.x} y2={avgP1.y} className={styles.gaugeAvgLineBorder} />
            <line x1={avgP0.x} y1={avgP0.y} x2={avgP1.x} y2={avgP1.y} className={styles.gaugeAvgLine} />
          </svg>
          <span
            className={styles.gaugeAvgLabel}
            style={{ left: `${avgLabelPoint.x}%`, top: `${(avgLabelPoint.y / 54) * 100}%` }}
          >
            평균
          </span>
          <span
            className={styles.gaugeMaxLabel}
            style={{ left: `${maxLabelPoint.x}%`, top: `calc(${(maxLabelPoint.y / 54) * 100}% + 4px)` }}
          >
            최대 ₩{Math.round(scaleMax).toLocaleString("ko-KR")}
          </span>
        </div>
      </div>
      <p className={`${styles.note} ${styles.perCapitaNote}`}>전체 지역 평균 {avgText}</p>
    </div>
  );
}

/** 주말 비중 카드. 미니막대=heatmap by_day(요일별 유동인구) 실데이터. 헤더엔 매출 비중 1위(+공동 2위) 요일을 표시. */
export function WeekendCard({
  days = null,
  onExpand,
}: {
  days?: { slot: string; avg_population: number | null }[] | null;
  onExpand?: () => void;
}) {
  // 요일별 유동인구를 최댓값 대비 비율(%) 막대로. 데이터 없으면 지표없음.
  const vals = days && days.length > 0 ? days.map((d) => d.avg_population ?? 0) : null;
  const bars = vals ? buildMiniBars(vals) : null;
  const top = bars && days ? topTierDays(bars, days.map((d) => d.slot)) : null;
  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <div>
          <h3 className={styles.title}>요일별 매출</h3>
        </div>
        <div className={styles.weekendHeadRightNum}>
          {top && <span className={`${styles.deltaTagBlue} ${styles.weekendTagInline}`}>{top.label}</span>}
          {top && <span className={styles.dnBig}>{top.pct}%</span>}
          {onExpand && (
            <button type="button" className={styles.expandBtn} onClick={onExpand} aria-label="요일별 매출 확대">
              ⤢
            </button>
          )}
        </div>
      </div>
      <div className={styles.weekendRow}>
        {bars ? (
          <div className={`${styles.miniBars} ${styles.weekendBars}`}>
            {bars.map((b, i) => (
              <div key={days![i].slot} className={styles.miniCol}>
                <div className={styles.miniTrack}>
                  <div className={styles.miniBarWrap} style={{ height: `${b.heightPct}%` }}>
                    <span className={`${styles.miniVal} ${styles.weekendMiniVal}`}>{b.pct}%</span>
                    <span className={top?.idxs.has(i) ? styles.miniBarTop : styles.miniBar} />
                  </div>
                </div>
                <span className={`${styles.miniSlot} ${styles.weekendMiniSlot}`}>{days![i].slot}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.miniEmpty}>지표없음</div>
        )}
      </div>
    </div>
  );
}
