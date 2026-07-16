import { useMemo, useState } from "react";
import styles from "./AgeGenderCard.module.css";

interface AgeGenderCardProps {
  /** { "10대": n, ... } — 여성 연령별 매출(원). null이면 데이터 없음. */
  ageFemale: Record<string, number> | null;
  /** { "10대": n, ... } — 남성 연령별 매출(원). null이면 데이터 없음. */
  ageMale: Record<string, number> | null;
}

const AGE_ORDER = ["10대", "20대", "30대", "40대", "50대", "60대이상"];
const AGE_LABEL: Record<string, string> = { "60대이상": "60대+" };

/**
 * 연령·성별 매출 카드. 하단 여성/남성 토글로 표시 대상을 바꾼다.
 * 막대 폭(rel)을 반올림 전 원값이 아니라 표시되는 pct(반올림값) 기준으로 계산해야,
 * 두 연령대가 같은 %로 반올림될 때 막대 길이도 항상 똑같아진다(요일별 매출 카드와 동일한 원칙).
 */
export default function AgeGenderCard({ ageFemale, ageMale }: AgeGenderCardProps) {
  const [gender, setGender] = useState<"female" | "male">("female");
  const active = gender === "female" ? ageFemale : ageMale;

  const rows = useMemo(() => {
    const src = active ?? {};
    const total = AGE_ORDER.reduce((a, k) => a + (src[k] ?? 0), 0) || 1;
    const pcts = AGE_ORDER.map((k) => Math.round(((src[k] ?? 0) / total) * 100));
    const maxPct = Math.max(1, ...pcts);
    return AGE_ORDER.map((k, i) => ({
      key: k,
      label: AGE_LABEL[k] ?? k,
      pct: pcts[i],
      rel: pcts[i] / maxPct,
    }));
  }, [active]);

  // 최다 연령대가 여럿(동률)이면 전부 묶어서 보여준다 — 예: 20대·30대 둘 다 26%면 "20대, 30대 26%".
  const topPct = useMemo(() => Math.max(0, ...rows.map((r) => r.pct)), [rows]);
  const topKeys = useMemo(() => new Set(rows.filter((r) => r.pct === topPct).map((r) => r.key)), [rows, topPct]);
  const topLabel = useMemo(
    () => rows.filter((r) => topKeys.has(r.key)).map((r) => r.label).join(", "),
    [rows, topKeys],
  );
  const hasData = active != null && Object.keys(active).length > 0;

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <div>
          <h3 className={styles.title}>연령·성별 매출</h3>
          <p className={styles.sub}>{hasData ? `최다 · ${topLabel} ${topPct}%` : "데이터 없음"}</p>
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

      <div className={styles.toggle}>
        <button
          type="button"
          className={gender === "female" ? styles.toggleActive : styles.toggleBtn}
          onClick={() => setGender("female")}
        >
          <i className={styles.dot} /> 여성
        </button>
        <button
          type="button"
          className={gender === "male" ? styles.toggleActive : styles.toggleBtn}
          onClick={() => setGender("male")}
        >
          <i className={styles.dot} /> 남성
        </button>
      </div>
    </div>
  );
}
