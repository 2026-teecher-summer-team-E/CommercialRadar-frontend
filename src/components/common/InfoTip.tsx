import type { ReactNode } from "react";
import styles from "./InfoTip.module.css";

interface Props {
  /** 툴팁 본문(문자열 또는 JSX). */
  children: ReactNode;
  /** 스크린리더용 트리거 설명. */
  label?: string;
  /** 말풍선 정렬(기본 left). 오른쪽 가장자리 필드면 "right"로 잘림 방지. */
  align?: "left" | "right";
}

/** 라벨 옆에 붙이는 ⓘ 도움말. 호버/포커스 시 말풍선 표시(CSS only). */
export default function InfoTip({ children, label = "도움말", align = "left" }: Props) {
  return (
    <span className={styles.wrap}>
      <button type="button" className={styles.trigger} aria-label={label}>
        i
      </button>
      <span className={`${styles.bubble} ${align === "right" ? styles.right : ""}`} role="tooltip">
        {children}
      </span>
    </span>
  );
}
