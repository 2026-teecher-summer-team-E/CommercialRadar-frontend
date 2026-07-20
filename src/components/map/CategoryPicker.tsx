import { useEffect, useRef, useState } from "react";
import type { CategoryGroup } from "./categoryList";
import styles from "./FilterBar.module.css";

interface CategoryPickerProps {
  groups: readonly CategoryGroup[];
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
  /** 트리거 버튼 왼쪽에 고정 표시할 정적 라벨("업종" + 구분선은 버튼 바깥에 위치). */
  label: string;
  /** true면 내부 라벨/구분선을 숨기고 트리거 버튼만 꽉 채워 표시한다(외부에서 별도 라벨을 두는 폼 필드용). */
  hideLabel?: boolean;
}

/** 대분류 → 소분류 드릴다운 업종 선택기. 라벨/구분선은 정적 영역, 선택값 버튼만 활성 강조·드롭다운 트리거. */
export default function CategoryPicker({
  groups,
  value,
  onChange,
  placeholder = "전체",
  label,
  hideLabel = false,
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
  // 소분류가 선택된 경우 부모 대분류를 찾아 "대분류 > 소분류"로 노출(대분류는 흐리게, 소분류는 진하게).
  const parentGroup = !isDefault ? groups.find((g) => g.items.includes(value))?.group ?? null : null;

  return (
    <div className={styles.categoryPicker}>
      {!hideLabel && (
        <>
          <span className={styles.categoryPickerLabel}>{label}</span>
          <span className={styles.categoryPickerDivider} aria-hidden />
        </>
      )}
      <div className={styles.categoryTriggerWrap} ref={rootRef}>
        <button
          type="button"
          className={`${styles.categoryTrigger} ${hideLabel ? styles.categoryTriggerBoxed : ""} ${isDefault ? "" : styles.categoryTriggerActive} ${open ? styles.categoryTriggerOpen : ""}`}
          onClick={toggle}
        >
          <span className={styles.categoryValue}>
            {isDefault ? (
              <span className={styles.categoryValueMain}>{placeholder}</span>
            ) : (
              <>
                {parentGroup && (
                  <>
                    <span className={styles.categoryValueParent}>{parentGroup}</span>
                    <span className={styles.categoryValueSep} aria-hidden>
                      &gt;
                    </span>
                  </>
                )}
                <span className={styles.categoryValueMain}>{value}</span>
              </>
            )}
          </span>
          <span className={styles.categoryCaret} aria-hidden>
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
    </div>
  );
}
