import { useEffect, useMemo, useRef, useState } from "react";

import type { AgeSlice } from "../../types";

export type AtmoScenario = "low" | "mid" | "high";

interface Props {
  scenario: AtmoScenario;
  ageDistribution?: AgeSlice[];
  /** 클릭한 시나리오의 누적 생존율 %(실데이터). 점포 불빛 비율에 사용. */
  survivalPct?: number | null;
  /** 평균 유동인구(avg_population, 실데이터). 등장 인원 수에 사용. */
  footTraffic?: number | null;
  onClose: () => void;
}

// 미래 연령분포 예측이 없을 때의 폴백(예시) 구성비.
const AGE_FALLBACK: AgeSlice[] = [
  { name: "20대", pct: 25 },
  { name: "30대", pct: 21 },
  { name: "40대", pct: 13 },
  { name: "50대", pct: 14 },
  { name: "60대+", pct: 27 },
];

// 연령 라벨 → 색. 백엔드 원본 라벨("60대이상")과 표기 변형("60대+") 모두 커버.
const AGE_COLORS: Record<string, string> = {
  "10대": "#a78bfa",
  "20대": "#7c6ef0",
  "30대": "#2fbf87",
  "40대": "#5b9bf0",
  "50대": "#f0a020",
  "60대+": "#f0685f",
  "60대이상": "#f0685f",
};
const PALETTE = ["#7c6ef0", "#2fbf87", "#5b9bf0", "#f0a020", "#f0685f", "#a78bfa", "#22d3ee"];

const SCENARIO = {
  high: { title: "잘풀린 미래", mood: "활기찬 상권", count: 16, lit: 0.65, street: "#c8d0dc", accent: "#16a34a", desc: "사람이 북적이는 미래 — 유동인구가 몰립니다." },
  mid: { title: "보통 미래", mood: "무난한 상권", count: 9, lit: 0.4, street: "#c2c8d4", accent: "#2563eb", desc: "평소 수준의 미래 — 꾸준한 발걸음." },
  low: { title: "안풀린 미래", mood: "한산한 상권", count: 4, lit: 0.15, street: "#b7bcc7", accent: "#dc2626", desc: "발길이 뜸한 미래 — 거리가 비어갑니다." },
} as const;

interface Person {
  id: number;
  color: string;
  bag: boolean;
  row: number;
}

export default function AtmosphereSimulation({ scenario, ageDistribution, survivalPct, footTraffic, onClose }: Props) {
  const cfg = SCENARIO[scenario];

  // 실데이터 연동: 점포 불빛=누적 생존율, 인원 수=평균 유동인구(로그 스케일)×생존율.
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const litRatio = survivalPct != null ? clamp(survivalPct / 100, 0.05, 1) : cfg.lit;
  const count =
    footTraffic != null && footTraffic > 0
      ? clamp(Math.round((Math.log10(footTraffic) - 4) * 4 * litRatio), 3, 20)
      : cfg.count;
  const realBased = survivalPct != null || (footTraffic != null && footTraffic > 0);
  const [playing, setPlaying] = useState(true);
  const [xs, setXs] = useState<number[]>([]);
  const timer = useRef<number | null>(null);

  const isReal = !!(ageDistribution && ageDistribution.length > 0);
  // 색을 입힌 연령 구성비.
  const ages = useMemo(() => {
    const base = isReal ? ageDistribution! : AGE_FALLBACK;
    return base.map((a, i) => ({ ...a, color: AGE_COLORS[a.name] ?? PALETTE[i % PALETTE.length] }));
  }, [ageDistribution, isReal]);

  const weightedAge = useMemo(() => {
    const total = ages.reduce((s, a) => s + a.pct, 0) || 1;
    return (rnd: number): string => {
      let acc = 0;
      for (const a of ages) {
        acc += a.pct / total;
        if (rnd <= acc) return a.color;
      }
      return ages[ages.length - 1]?.color ?? "#7c6ef0";
    };
  }, [ages]);

  const people = useMemo<Person[]>(() => {
    const out: Person[] = [];
    for (let i = 0; i < count; i++) {
      const r = ((i * 9301 + 49297) % 233280) / 233280;
      const r2 = ((i * 4021 + 3571) % 100) / 100;
      out.push({ id: i, color: weightedAge(r), bag: r2 > 0.55, row: (i % 5) / 4 });
    }
    return out;
  }, [count, weightedAge]);

  useEffect(() => {
    setXs(people.map((_, i) => 6 + ((i * 37) % 88)));
    if (timer.current) window.clearInterval(timer.current);
    if (playing) {
      timer.current = window.setInterval(() => {
        setXs((prev) => {
          const next = [...prev];
          const n = Math.max(1, Math.round(prev.length / 4));
          for (let k = 0; k < n; k++) {
            const idx = Math.floor((Date.now() / (137 + k * 53)) % prev.length);
            next[idx] = 6 + Math.floor((Date.now() / (11 + idx)) % 88);
          }
          return next;
        });
      }, 1400);
    }
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [people, playing]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const windows = Array.from({ length: 27 });
  const playState = playing ? "running" : "paused";

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(16,20,30,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, fontFamily: '"Apple SD Gothic Neo","Pretendard","Noto Sans KR",sans-serif' }}
    >
      <style>{`
        @keyframes atmo-sway { 0%,100%{transform:translateX(-5px)} 50%{transform:translateX(5px)} }
        @keyframes atmo-bob  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
        @keyframes atmo-in   { from{opacity:0} to{opacity:1} }
        @keyframes atmo-glow { 0%,100%{opacity:.5} 50%{opacity:.85} }
      `}</style>

      <div onClick={(e) => e.stopPropagation()} style={{ width: 560, background: "#fff", borderRadius: 18, padding: "20px 22px", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 12, color: "#8b90a0" }}>상권 분위기 시뮬레이션</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: cfg.accent, marginTop: 2 }}>
              {cfg.title} <span style={{ color: "#1a1d29", fontWeight: 700 }}>· {cfg.mood}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setPlaying((p) => !p)} style={{ border: "1px solid #e2e5ec", background: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 13, cursor: "pointer" }}>
              {playing ? "⏸ 정지" : "▶ 재생"}
            </button>
            <button onClick={onClose} style={{ border: "1px solid #e2e5ec", background: "#fff", borderRadius: 8, width: 32, cursor: "pointer", fontSize: 15 }}>✕</button>
          </div>
        </div>

        <div style={{ position: "relative", height: 300, marginTop: 14, borderRadius: 14, overflow: "hidden", background: "#0f1626" }}>
          <div style={{ position: "absolute", inset: 0, height: "45%", background: "linear-gradient(#141d30,#0f1626)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(9,1fr)", gap: 10, padding: "16px 18px" }}>
              {windows.map((_, i) => {
                const on = ((i * 7 + 3) % 100) / 100 < litRatio;
                return (
                  <div key={i} style={{ height: 20, borderRadius: 5, background: on ? "#d9c26a" : "#1b2740", opacity: on ? 0.85 : 0.5, animation: on ? `atmo-glow ${2 + (i % 4)}s ease-in-out ${i * 0.1}s infinite` : "none", animationPlayState: playState }} />
                );
              })}
            </div>
          </div>
          <div style={{ position: "absolute", top: "31%", left: "50%", transform: "translateX(-50%)", width: 200, height: 34, borderRadius: 8, border: `1.5px solid ${cfg.accent}`, background: "rgba(37,99,235,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#dbe4ff", fontSize: 14, boxShadow: `0 0 16px ${cfg.accent}55` }}>
            상가
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "56%", background: `linear-gradient(${cfg.street},#eef1f6)` }} />
          {people.map((p, i) => {
            const scale = 0.62 + p.row * 0.5;
            const bottom = 14 + p.row * 96;
            const x = xs[i] ?? 50;
            return (
              <div key={p.id} style={{ position: "absolute", left: `${x}%`, bottom, transform: `translateX(-50%) scale(${scale})`, transformOrigin: "bottom center", transition: "left 2.6s ease-in-out", zIndex: Math.round(p.row * 10), animation: `atmo-in .5s ease ${i * 0.05}s both` }}>
                <div style={{ animation: `atmo-sway ${2.4 + (i % 5) * 0.4}s ease-in-out ${i * 0.2}s infinite`, animationPlayState: playState }}>
                  <div style={{ animation: `atmo-bob ${1.6 + (i % 3) * 0.3}s ease-in-out infinite`, animationPlayState: playState, display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ width: 13, height: 13, borderRadius: "50%", background: p.color }} />
                    <div style={{ width: 20, height: 24, borderRadius: "9px 9px 5px 5px", background: p.color, marginTop: 1, position: "relative" }}>
                      {p.bag && <div style={{ position: "absolute", right: -6, bottom: 2, width: 9, height: 11, borderRadius: 2, background: "#1c2333" }} />}
                    </div>
                    <div style={{ width: 22, height: 6, borderRadius: "50%", background: "rgba(0,0,0,0.22)", marginTop: 2, filter: "blur(1px)" }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12, color: "#6b7180", marginBottom: 6 }}>유동인구 예상 연령 분포</div>
          <div style={{ display: "flex", height: 10, borderRadius: 6, overflow: "hidden" }}>
            {ages.map((a) => (
              <div key={a.name} style={{ width: `${a.pct}%`, background: a.color }} />
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginTop: 8 }}>
            {ages.map((a) => (
              <span key={a.name} style={{ fontSize: 12, color: "#4b5063", display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: a.color }} /> {a.name} {a.pct}%
              </span>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "#a2a7b5", marginTop: 6 }}>
            {isReal ? "연령 구성비 · 최근 관측 실데이터" : "※ 연령 구성비 · 예시(관측 데이터 없음)"}
          </div>
        </div>

        <div style={{ fontSize: 12, color: "#8b90a0", marginTop: 10 }}>{cfg.desc}</div>
        {realBased && (
          <div style={{ fontSize: 11, color: "#a2a7b5", marginTop: 4 }}>
            점포 불빛{survivalPct != null ? ` = 누적 생존율 ${Math.round(survivalPct)}%` : ""}
            {footTraffic != null && footTraffic > 0 ? " · 인원 = 평균 유동인구 기반" : ""}
          </div>
        )}
      </div>
    </div>
  );
}
