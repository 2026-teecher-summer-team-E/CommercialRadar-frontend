import styles from "./FavoriteStar.module.css";

interface FavoriteStarProps {
  active: boolean;
  disabled?: boolean;
  onToggle: () => void;
}

/** 즐겨찾기(관심 상권) 토글 버튼. 채워진 별=등록됨, 빈 별=미등록. */
export default function FavoriteStar({ active, disabled, onToggle }: FavoriteStarProps) {
  return (
    <button
      type="button"
      className={`${styles.btn} ${active ? styles.active : ""}`}
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={active}
      aria-label={active ? "즐겨찾기 해제" : "즐겨찾기 추가"}
    >
      {active ? "★" : "☆"}
    </button>
  );
}
