/**
 * RegressionCard — 강남역 폐업 요인 OLS 회귀분석 결과 카드.
 * 강남역 상권(id=1315)에서만 렌더링. 하드코딩된 실측 분석 결과(n=962, R²=0.021).
 */
import styles from "./RegressionCard.module.css";

interface RegressionFactor {
  /** 표시 변수명 */
  label: string;
  /** 표준화 계수(양수=위험, 음수=보호) */
  coef: number;
  /** t 통계량 */
  tStat: number;
  /** p 값 */
  pValue: number;
  /** 유의도 기호: "***" | "**" | "*" | "ns" */
  sig: "***" | "**" | "*" | "ns";
}

/** 강남역 폐업 요인 OLS 실측 계수 (n=962, R²=0.021). 절대 임의로 수정 금지. */
const FACTORS: RegressionFactor[] = [
  { label: "개업률", coef: 0.246, tStat: 2.17, pValue: 0.030, sig: "*" },
  { label: "log(점포수)", coef: -0.118, tStat: -1.01, pValue: 0.314, sig: "ns" },
  { label: "log(점포당 매출)", coef: -0.475, tStat: -2.67, pValue: 0.008, sig: "**" },
  { label: "log(점포당 거래건수)", coef: 0.621, tStat: 3.52, pValue: 0.000, sig: "***" },
];

/** diverging bar 최대 기준값(|coef| 최대 = 0.621). */
const MAX_COEF = 0.621;

export default function RegressionCard() {
  return (
    <div className={styles.card}>
      {/* 카드 헤더 */}
      <div className={styles.head}>
        <div>
          <h3 className={styles.title}>폐업 요인 회귀분석</h3>
          <p className={styles.sub}>강남역 업종×분기 실측 · OLS · n=962 · R²=0.021</p>
        </div>
        <div className={styles.badges}>
          <span className={styles.badge}>n=962</span>
          <span className={styles.badge}>R²=0.021</span>
        </div>
      </div>

      {/* 범례 */}
      <div className={styles.legend}>
        <span className={styles.legendProtect}>◀ 보호 (음수)</span>
        <span className={styles.legendZero}>0</span>
        <span className={styles.legendRisk}>위험 (양수) ▶</span>
      </div>

      {/* Diverging bar chart */}
      <ul className={styles.factorList} role="list">
        {FACTORS.map((f) => {
          const isNs = f.sig === "ns";
          const isNeg = f.coef < 0;
          const pct = (Math.abs(f.coef) / MAX_COEF) * 100;

          return (
            <li key={f.label} className={styles.factorRow}>
              <span className={styles.factorLabel}>{f.label}</span>

              <div className={styles.barWrap}>
                {/* 왼쪽(음수=보호) 영역 */}
                <div className={styles.barLeft}>
                  {isNeg && (
                    <div
                      className={`${styles.bar} ${styles.barProtect} ${isNs ? styles.barNs : ""}`}
                      style={{ width: `${pct}%` }}
                      aria-label={`${f.label} 계수 ${f.coef}, ${f.sig}`}
                      role="img"
                    />
                  )}
                </div>

                {/* 중심선 */}
                <div className={styles.centerLine} aria-hidden="true" />

                {/* 오른쪽(양수=위험) 영역 */}
                <div className={styles.barRight}>
                  {!isNeg && (
                    <div
                      className={`${styles.bar} ${styles.barRisk} ${isNs ? styles.barNs : ""}`}
                      style={{ width: `${pct}%` }}
                      aria-label={`${f.label} 계수 ${f.coef}, ${f.sig}`}
                      role="img"
                    />
                  )}
                </div>
              </div>

              <span className={`${styles.coefVal} ${isNs ? styles.coefNs : isNeg ? styles.coefNeg : styles.coefPos}`}>
                {f.coef > 0 ? "+" : ""}
                {f.coef.toFixed(3)}
              </span>
              <span className={`${styles.sigBadge} ${isNs ? styles.sigNs : styles.sigSig}`}>
                {f.sig}
              </span>
            </li>
          );
        })}
      </ul>

      {/* 해석 문구 */}
      <div className={styles.insights}>
        <p className={styles.insightItem}>
          점포당 매출이 높은 업종일수록 폐업 위험이 낮습니다(가장 강한 방어 요인).
        </p>
        <p className={styles.insightItem}>
          매출 대비 거래건수가 많은 박리다매형 업종일수록 폐업 위험이 높습니다.
        </p>
        <p className={styles.insightItem}>
          점포수(규모)는 폐업과 통계적으로 무관 — 강남역 안에서 생존을 가르는 건 '입지'가 아니라 '업종 수익성'.
        </p>
      </div>

      {/* 방법론 각주 */}
      <p className={styles.footnote}>
        OLS 회귀, 설명변수 표준화(z). *p&lt;.05 **p&lt;.01 ***p&lt;.001. R²가 낮은 건 동일 상권 내에선 유동인구·임대료 등 입지 변수가 상수이기 때문.
      </p>
    </div>
  );
}
