import { useEffect, useRef, useState } from "react";

/** 접근성: 사용자가 '모션 줄이기'를 켰으면 애니메이션을 건너뛴다. */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

interface CountUpOptions {
  /** 애니메이션 길이(ms). 기본 900. */
  duration?: number;
  /** 시작 지연(ms). 기본 0. */
  delay?: number;
  /** 시작 값. 기본 0. */
  from?: number;
}

/**
 * `target` 을 `from`(기본 0)에서부터 duration 동안 easeOut 으로 카운트업한 현재 값을 반환.
 * - `target` 이 null/undefined 면 그대로 null 을 반환(포맷 측에서 "—" 처리).
 * - '모션 줄이기' 환경에서는 즉시 target 을 반환.
 * - target 이 바뀌면 새 값으로 다시 카운트업한다.
 */
export function useCountUp(
  target: number | null | undefined,
  { duration = 900, delay = 0, from = 0 }: CountUpOptions = {},
): number | null {
  const [value, setValue] = useState<number | null>(target ?? null);
  const frameRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (target == null) {
      setValue(null);
      return;
    }
    if (prefersReducedMotion() || duration <= 0) {
      setValue(target);
      return;
    }

    let start: number | null = null;
    const step = (ts: number) => {
      if (start == null) start = ts;
      const t = Math.min(1, (ts - start) / duration);
      setValue(from + (target - from) * easeOutCubic(t));
      if (t < 1) frameRef.current = requestAnimationFrame(step);
    };

    setValue(from);
    timeoutRef.current = setTimeout(() => {
      frameRef.current = requestAnimationFrame(step);
    }, delay);

    return () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
      if (timeoutRef.current != null) clearTimeout(timeoutRef.current);
    };
  }, [target, duration, delay, from]);

  return value;
}
