import { useCallback, useEffect, useState } from "react";
import styles from "./Toast.module.css";

/** 하단 중앙에 잠깐 떴다 사라지는 비차단 알림 pill. message 가 null 이면 렌더하지 않는다. */
export default function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className={styles.toast} role="status" aria-live="polite">
      {message}
    </div>
  );
}

/**
 * 토스트 표시 상태 훅. showToast(msg) 로 띄우면 duration(ms) 후 자동으로 사라진다.
 * tick 으로 타이머를 재설정해 같은 메시지를 연속으로 띄워도 매번 갱신된다.
 */
export function useToast(duration = 2500) {
  const [message, setMessage] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const showToast = useCallback((msg: string) => {
    setMessage(msg);
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    if (tick === 0) return;
    const timer = setTimeout(() => setMessage(null), duration);
    return () => clearTimeout(timer);
  }, [tick, duration]);

  return { message, showToast };
}
