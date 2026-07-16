import styles from "./FloorRentCard.module.css";
import type { RentBar } from "./RentCard";

interface FloorRentCardProps {
  bars: RentBar[];
}

/** 원 → ₩ + 천단위 콤마(예: ₩85,203). null 이면 "—". */
function fmtWon(won: number | null): string {
  if (won == null) return "—";
  return `₩${Math.round(won).toLocaleString("ko-KR")}`;
}

/**
 * 상가유형별 임대료 카드. RentCard의 대표값 옆에 있던 유형별 막대를 독립 카드로 분리한 것.
 * label(소규모/중대형/집합)은 건물 층수가 아니라 한국부동산원 R-ONE 상가유형 분류다
 * (소규모=2층 이하·연면적 330㎡ 미만, 중대형=3층 이상 또는 330㎡ 이상, 집합=구분소유 집합건물 상가).
 */
export default function FloorRentCard({ bars }: FloorRentCardProps) {
  const max = Math.max(1, ...bars.map((b) => b.value ?? 0));
  const hasBars = bars.some((b) => b.value != null);

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <h3 className={styles.title}>상가유형별 임대료</h3>
        <span className={styles.sub}>㎡당 환산 임대료</span>
      </div>

      {hasBars ? (
        <div className={styles.bars}>
          {bars.map((b, i) => {
            const v = b.value ?? 0;
            const isMax = v === max;
            return (
              <div key={`${b.label}-${i}`} className={styles.barCol}>
                <div className={styles.barTrack}>
                  <div
                    className={isMax ? styles.barTop : styles.bar}
                    style={{ height: `${Math.max(8, (v / max) * 100)}%` }}
                    title={`${b.label}: ${fmtWon(b.value)}/㎡`}
                  >
                    <span className={styles.barVal}>{fmtWon(b.value)}</span>
                  </div>
                </div>
                <span className={styles.barLabel}>{b.label}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={styles.empty}>지표없음</div>
      )}
    </div>
  );
}
