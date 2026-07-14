import styles from "./TrendValue.module.css";

interface Props {
  value: number | null | undefined;
  format: (magnitude: number) => string;
}

/** 증감값을 화살표(▲/▼)와 색으로 표시. format은 절대값을 받아 크기만 문자열로 만든다. */
export default function TrendValue({ value, format }: Props) {
  if (value == null || Number.isNaN(value)) {
    return <span className={styles.flat}>-</span>;
  }
  const isUp = value > 0;
  const isDown = value < 0;
  const cls = isUp ? styles.up : isDown ? styles.down : styles.flat;
  const arrow = isUp ? "▲" : isDown ? "▼" : "–";
  return (
    <span className={cls}>
      <span className={styles.arrow}>{arrow}</span> {format(Math.abs(value))}
    </span>
  );
}
