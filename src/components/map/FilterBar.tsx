import { useEffect, useRef, useState } from "react";
import { GU_FILTER_OPTIONS, POPULATION_FILTER_OPTIONS, TYPE_FILTER_OPTIONS, type PopulationBucket } from "./mapData";
import styles from "./FilterBar.module.css";

interface FilterBarProps {
  typeFilter: string;
  onTypeFilterChange: (v: string) => void;
  guFilter: string;
  onGuFilterChange: (v: string) => void;
  popFilter: PopulationBucket;
  onPopFilterChange: (v: PopulationBucket) => void;
}

type PillKey = "type" | "gu" | "population";

/** 검색바 아래 직방 스타일 필터 pill: 자치구 / 상권유형 / 유동인구(지도 마커·구역을 실제로 필터링). */
export default function FilterBar({
  typeFilter,
  onTypeFilterChange,
  guFilter,
  onGuFilterChange,
  popFilter,
  onPopFilterChange,
}: FilterBarProps) {
  const [open, setOpen] = useState<PillKey | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const toggle = (key: PillKey) => setOpen((prev) => (prev === key ? null : key));

  const hasActiveFilter = guFilter !== "전체" || typeFilter !== "전체" || popFilter !== "전체";
  const resetAll = () => {
    onGuFilterChange("전체");
    onTypeFilterChange("전체");
    onPopFilterChange("전체");
    setOpen(null);
  };

  return (
    <div className={styles.bar} ref={rootRef}>
      <Pill
        label="자치구"
        value={guFilter}
        isOpen={open === "gu"}
        onToggle={() => toggle("gu")}
        scrollable
      >
        {GU_FILTER_OPTIONS.map((g) => (
          <Option
            key={g}
            label={g}
            active={guFilter === g}
            onClick={() => {
              onGuFilterChange(g);
              setOpen(null);
            }}
          />
        ))}
      </Pill>

      <Pill
        label="상권유형"
        value={typeFilter}
        isOpen={open === "type"}
        onToggle={() => toggle("type")}
      >
        {TYPE_FILTER_OPTIONS.map((t) => (
          <Option
            key={t}
            label={t}
            active={typeFilter === t}
            onClick={() => {
              onTypeFilterChange(t);
              setOpen(null);
            }}
          />
        ))}
      </Pill>

      <Pill
        label="유동인구"
        value={popFilter}
        isOpen={open === "population"}
        onToggle={() => toggle("population")}
      >
        {POPULATION_FILTER_OPTIONS.map((p) => (
          <Option
            key={p}
            label={p}
            active={popFilter === p}
            onClick={() => {
              onPopFilterChange(p);
              setOpen(null);
            }}
          />
        ))}
      </Pill>

      {hasActiveFilter && (
        <button type="button" className={styles.resetBtn} onClick={resetAll}>
          ✕ 필터 초기화
        </button>
      )}
    </div>
  );
}

function Pill({
  label,
  value,
  isOpen,
  onToggle,
  scrollable,
  children,
}: {
  label: string;
  value: string;
  isOpen: boolean;
  onToggle: () => void;
  scrollable?: boolean;
  children: React.ReactNode;
}) {
  const isDefault = value === "전체";
  return (
    <div className={styles.pillWrap}>
      <button
        type="button"
        className={`${styles.pill} ${isDefault ? "" : styles.pillActive} ${isOpen ? styles.pillOpen : ""}`}
        onClick={onToggle}
      >
        {isDefault ? label : value}
        <span className={styles.pillCaret} aria-hidden>
          {isOpen ? "▴" : "▾"}
        </span>
      </button>
      {isOpen && (
        <div className={`${styles.dropdown} ${scrollable ? styles.dropdownScroll : ""}`}>{children}</div>
      )}
    </div>
  );
}

function Option({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`${styles.option} ${active ? styles.optionActive : ""}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
