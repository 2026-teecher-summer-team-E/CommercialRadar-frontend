import { useEffect, useRef, useState } from "react";
import styles from "./FilterDropdown.module.css";

interface Props {
  /** 기본(전체) 상태에서 "{label} 전체"로 표시할 접두. */
  label: string;
  /** 현재 선택값. "" = 전체. */
  value: string;
  /** 전체를 제외한 선택지 목록. */
  options: string[];
  onChange: (v: string) => void;
  ariaLabel?: string;
}

/**
 * 지도 FilterBar와 동일한 톤의 커스텀 단일선택 드롭다운.
 * 네이티브 select 대신 트리거 버튼 + 카드형 옵션 목록(바깥클릭·Esc 닫기)로 서비스 UI와 통일.
 */
export default function FilterDropdown({ label, value, options, onChange, ariaLabel }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const isDefault = value === "";
  const select = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <div className={styles.wrap} ref={rootRef}>
      <button
        type="button"
        className={`${styles.trigger} ${isDefault ? "" : styles.triggerActive} ${open ? styles.triggerOpen : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel ?? label}
      >
        {isDefault ? `${label} 전체` : value}
        <span className={styles.caret} aria-hidden>
          {open ? "▴" : "▾"}
        </span>
      </button>
      {open && (
        <div className={styles.menu} role="listbox">
          <button
            type="button"
            role="option"
            aria-selected={isDefault}
            className={`${styles.option} ${isDefault ? styles.optionActive : ""}`}
            onClick={() => select("")}
          >
            {label} 전체
          </button>
          {options.map((o) => (
            <button
              key={o}
              type="button"
              role="option"
              aria-selected={value === o}
              className={`${styles.option} ${value === o ? styles.optionActive : ""}`}
              onClick={() => select(o)}
            >
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
