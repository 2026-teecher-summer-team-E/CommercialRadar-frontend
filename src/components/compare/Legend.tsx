import { seriesGradient } from "./format";
import styles from "./Legend.module.css";

interface Props {
  names: string[];
}

/** 상권명 + 시리즈색 점 범례. */
export default function Legend({ names }: Props) {
  return (
    <ul className={styles.legend}>
      {names.map((name, i) => (
        <li key={`${name}-${i}`} className={styles.item}>
          <span className={styles.dot} style={{ background: seriesGradient(i) }} />
          <span className={styles.name}>{name}</span>
        </li>
      ))}
    </ul>
  );
}
