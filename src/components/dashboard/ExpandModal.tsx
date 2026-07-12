import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import styles from "./ExpandModal.module.css";

interface ExpandModalProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}

/** 딤 배경 + X 닫기 확대 모달. Esc/배경 클릭으로 닫힘. 접근성: aria-labelledby, focus trap, 자동 포커스. */
export default function ExpandModal({ title, subtitle, onClose, children }: ExpandModalProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Escape 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // 모달 열릴 때 닫기 버튼에 자동 포커스
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  // Focus trap
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab") return;
    const modal = modalRef.current;
    if (!modal) return;
    const focusable = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  };

  return (
    <div className={styles.backdrop} onClick={onClose} role="presentation">
      <div
        ref={modalRef}
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={handleKeyDown}
      >
        <div className={styles.header}>
          <div>
            <h3 id={titleId} className={styles.title}>{title}</h3>
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
          <button ref={closeRef} type="button" className={styles.close} onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  );
}
