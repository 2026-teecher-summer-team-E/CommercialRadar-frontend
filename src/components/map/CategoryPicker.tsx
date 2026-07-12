import { useEffect, useRef, useState } from "react";
import type { CategoryGroup } from "./categoryList";
import styles from "./FilterBar.module.css";

interface CategoryPickerProps {
  groups: readonly CategoryGroup[];
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
  /** 좁은 자리(SangkwonPanel)용 축소 스타일. */
  compact?: boolean;
}

/** 대분류 → 소분류 드릴다운 업종 선택기(pill + dropdown). FilterBar/SangkwonPanel 공용. */
export default function CategoryPicker({
  groups,
  value,
  onChange,
  placeholder = "전체",
  compact = false,
}: CategoryPickerProps) {
  const [open, setOpen] = useState(false);
  const [activeGroupName, setActiveGroupName] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const toggle = () => {
    setOpen((p) => !p);
    setActiveGroupName(null);
  };

  const activeGroup = groups.find((g) => g.group === activeGroupName);
  const isDefault = value == null;

  return (
    <div className={styles.pillWrap} ref={rootRef}>
      <button
        type="button"
        className={`${styles.pill} ${compact ? styles.pillCompact : ""} ${isDefault ? "" : styles.pillActive} ${open ? styles.pillOpen : ""}`}
        onClick={toggle}
      >
        {isDefault ? placeholder : value}
        <span className={styles.pillCaret} aria-hidden>
          {open ? "▴" : "▾"}
        </span>
      </button>
      {open && (
        <div className={`${styles.dropdown} ${styles.dropdownScroll}`}>
          {activeGroup ? (
            <>
              <button type="button" className={styles.backOption} onClick={() => setActiveGroupName(null)}>
                ‹ {activeGroup.group}
              </button>
              {activeGroup.items.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`${styles.option} ${value === c ? styles.optionActive : ""}`}
                  onClick={() => {
                    onChange(c);
                    setOpen(false);
                    setActiveGroupName(null);
                  }}
                >
                  {c}
                </button>
              ))}
            </>
          ) : (
            <>
              <button
                type="button"
                className={`${styles.option} ${isDefault ? styles.optionActive : ""}`}
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                전체
              </button>
              {groups.map(({ group }) => (
                <button
                  key={group}
                  type="button"
                  className={styles.groupOption}
                  onClick={() => setActiveGroupName(group)}
                >
                  {group}
                  <span aria-hidden>›</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
