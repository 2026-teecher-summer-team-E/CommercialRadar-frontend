import styles from "./RentCard.module.css";

export interface RentBar {
  label: string;
  /** ㎡당 원 단위 임대료. */
  value: number | null;
}

interface RentCardProps {
  /** 대표 ㎡당 임대료(만원 환산 전, 원 단위). null 이면 "—". */
  perSqm: number | null;
  /** 대표값의 상가유형(소규모/중대형/집합). 건물 층수가 아니라 R-ONE 상가유형 분류. */
  typeLabel: string | null;
}

/** 원 → ₩ + 천단위 콤마(예: ₩85,203). null 이면 "—". */
function fmtWon(won: number | null): string {
  if (won == null) return "—";
  return `₩${Math.round(won).toLocaleString("ko-KR")}`;
}

/** 임대료(m²당) 카드. Figma 재현: 큰 값 + 안내 태그. 상가유형별 막대는 FloorRentCard로 분리. */
export default function RentCard({ perSqm, typeLabel }: RentCardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <h3 className={styles.title}>임대료</h3>
        <span className={styles.sub}>
          {typeLabel ? `${typeLabel}상가 기준 · ㎡당 환산 임대료` : "㎡당 환산 임대료"}
        </span>
      </div>

      <div className={styles.big}>
        <span className={styles.num}>{fmtWon(perSqm)}</span>
        <span className={styles.unit}>/㎡</span>
      </div>

      <p className={styles.note}>한국부동산원 R-ONE · 권리금 포함</p>
    </div>
  );
}
