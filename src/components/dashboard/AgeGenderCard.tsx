import { useMemo } from "react";
import styles from "./AgeGenderCard.module.css";

interface AgeGenderCardProps {
  /** { "10대": n, ... } — 연령대별 유동인구(실데이터, 성별 교차 없음). */
  ageDist: Record<string, number> | null;
  /** 여성/남성 비중(%, 실데이터 marginal). null이면 배지 숨김. */
  genderPct?: { female: number; male: number } | null;
}

const AGE_ORDER = ["10대", "20대", "30대", "40대", "50대", "60대이상"];
const AGE_LABEL: Record<string, string> = { "60대이상": "60대+" };

/**
 * 연령·매출 카드. Figma 재현: 연령대 가로 막대 + 최다 연령 강조.
 * 서울 생활인구 API는 연령×성별 교차 데이터를 제공하지 않고 성별은 marginal
 * 총량(남/여 각각의 전체 합)만 있어, 연령 분포를 성별로 나눠 보여줄 수 없다
 * (예전엔 연령 분포를 성비로 스케일해 "성별 토글"처럼 보이게 했지만, 그 방식은
 * 카드 내부에서 다시 총합 대비 %로 정규화하기 때문에 스케일 상수가 약분되어
 * 어느 성별을 선택해도 % 값이 항상 똑같이 나오는 문제가 있었다). 실데이터인
 * 전체 성비만 헤더에 배지로 보여준다.
 */
export default function AgeGenderCard({ ageDist, genderPct = null }: AgeGenderCardProps) {
  // 막대 폭(rel)을 반올림 전 원값이 아니라 표시되는 pct(반올림값) 기준으로 계산해야,
  // 두 연령대가 같은 %로 반올림될 때 막대 길이도 항상 똑같아진다(요일별 매출 카드와 동일한 원칙).
  const rows = useMemo(() => {
    const src = ageDist ?? {};
    const total = AGE_ORDER.reduce((a, k) => a + (src[k] ?? 0), 0) || 1;
    const pcts = AGE_ORDER.map((k) => Math.round(((src[k] ?? 0) / total) * 100));
    const maxPct = Math.max(1, ...pcts);
    return AGE_ORDER.map((k, i) => ({
      key: k,
      label: AGE_LABEL[k] ?? k,
      pct: pcts[i],
      rel: pcts[i] / maxPct,
    }));
  }, [ageDist]);

  // 최다 연령대가 여럿(동률)이면 전부 묶어서 보여준다 — 예: 20대·30대 둘 다 26%면 "20대, 30대 26%".
  const topPct = useMemo(() => Math.max(0, ...rows.map((r) => r.pct)), [rows]);
  const topKeys = useMemo(() => new Set(rows.filter((r) => r.pct === topPct).map((r) => r.key)), [rows, topPct]);
  const topLabel = useMemo(
    () => rows.filter((r) => topKeys.has(r.key)).map((r) => r.label).join(", "),
    [rows, topKeys],
  );
  const hasData = ageDist != null && Object.keys(ageDist).length > 0;

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <div>
          <h3 className={styles.title}>연령별 매출</h3>
          <p className={styles.sub}>{genderPct ? `여 ${genderPct.female}% · 남 ${genderPct.male}%` : "성비 데이터 없음"}</p>
        </div>
        <div className={styles.headline}>{hasData ? `${topLabel} ${topPct}%` : "—"}</div>
      </div>

      {hasData ? (
        <div className={styles.bars}>
          {rows.map((r) => (
            <div key={r.key} className={styles.barRow}>
              <span className={styles.barLabel}>{r.label}</span>
              <div className={styles.barTrack}>
                <span
                  className={topKeys.has(r.key) ? styles.barFillTop : styles.barFill}
                  style={{ width: `${Math.max(4, r.rel * 100)}%` }}
                />
              </div>
              <span className={topKeys.has(r.key) ? styles.barPctTop : styles.barPct}>{r.pct}%</span>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>연령·성별 데이터가 없어요.</div>
      )}
    </div>
  );
}
