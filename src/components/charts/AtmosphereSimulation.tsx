import { useEffect, useMemo, useRef, useState } from "react";
import { DotLottieReact, type DotLottie } from "@lottiefiles/dotlottie-react";

import type { AgeSlice } from "../../types";

/**
 * 걷는 사람 Lottie 애니메이션 기본 경로(public/). 파일이 있으면 Lottie 군중,
 * 없으면 기존 색점 사람으로 자동 폴백한다. (오픈소스 걷기 애니메이션을 여기에 넣으면 됨)
 */
const CROWD_LOTTIE_BASE = "/lottie/walking.json";
/** 기본 Lottie가 바라보는 방향: 1=오른쪽, -1=왼쪽. 문워크로 보이면 이 값을 뒤집어라. */
const LOTTIE_FACING = 1;
/** 파일별 방향 보정 — 원본이 기본과 반대를 볼 때. 해당 파일만 문워크하면 부호를 뒤집어라. */
const FILE_FACING: Record<string, number> = {
  "/lottie/walking-5.json": -1, // 뽀빠이(노인)는 기본과 반대를 봄
  "/lottie/walking-7.json": -1, // 노인 여성(보행보조기)도 기본과 반대를 봄
};
/** walking-2.json, walking-3.json … 최대 이 수까지 자동 감지 */
const LOTTIE_VARIANT_MAX = 7;

/** 타임랩스: 분기당 표시 시간(ms), 끝에 정지 시간(ms), 총 분기 수 */
const TIMELAPSE_QUARTER_MS = 1200;
const TIMELAPSE_PAUSE_MS   = 2000;
const TIMELAPSE_QUARTERS   = 4;

export type AtmoScenario = "low" | "mid" | "high";

interface Props {
  scenario: AtmoScenario;
  ageDistribution?: AgeSlice[];
  /** 클릭한 시나리오의 누적 생존율 %(실데이터). 점포 불빛 비율에 사용. */
  survivalPct?: number | null;
  /** 유동인구(실데이터). 등장 인원 수에 사용. dayDominant 지정 시 해당 시간대 평균. */
  footTraffic?: number | null;
  /** true=낮 테마, false=밤 테마(기존), null/undefined=밤 테마(칩 미표시). */
  dayDominant?: boolean | null;
  /** 유리한 쪽 매출 비중 %(낮 유리면 낮 비중, 밤 유리면 밤 비중). 칩 문구용. */
  daySalesPct?: number | null;
  /** 외국인 비중 %(0~100). null이면 기본 8% 적용. */
  foreignerPct?: number | null;
  /** 시작 분기 문자열(예: "2025-Q4"). 미전달 시 "1분기차"~"4분기차" 상대 표기. */
  startQuarter?: string | null;
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
  "10대": "var(--series-4)",
  "20대": "var(--series-1)",
  "30대": "var(--series-5)",
  "40대": "var(--series-3)",
  "50대": "var(--series-6)",
  "60대+": "var(--series-7)",
  "60대이상": "var(--series-7)",
};
const PALETTE = [
  "var(--series-1)",
  "var(--series-5)",
  "var(--series-3)",
  "var(--series-6)",
  "var(--series-7)",
  "var(--series-4)",
  "var(--color-accent)",
];

/**
 * 연령 버킷별 시각/속도 특성.
 * hueRotate: ±10deg 이내로만 — 피부톤 왜곡 방지.
 * saturate/brightness: 연령 변주용. scaleBonus/speedMult: 체격·속도.
 */
const AGE_STYLE: Record<
  string,
  { hueRotate: number; saturate: number; brightness: number; scaleBonus: number; speedMult: number }
> = {
  "10대":     { hueRotate:  8, saturate: 1.15, brightness: 1.06, scaleBonus: 0.88, speedMult: 1.20 },
  "20대":     { hueRotate:  5, saturate: 1.10, brightness: 1.03, scaleBonus: 0.95, speedMult: 1.15 },
  "30대":     { hueRotate:  0, saturate: 1.05, brightness: 1.00, scaleBonus: 1.00, speedMult: 1.05 },
  "40대":     { hueRotate:  0, saturate: 1.00, brightness: 0.98, scaleBonus: 1.00, speedMult: 1.00 },
  "50대":     { hueRotate: -5, saturate: 0.92, brightness: 0.95, scaleBonus: 0.97, speedMult: 0.88 },
  "60대+":    { hueRotate: -8, saturate: 0.85, brightness: 0.90, scaleBonus: 0.88, speedMult: 0.75 },
  "60대이상": { hueRotate: -8, saturate: 0.85, brightness: 0.90, scaleBonus: 0.88, speedMult: 0.75 },
};
const AGE_STYLE_FALLBACK = { hueRotate: 0, saturate: 1.0, brightness: 1.0, scaleBonus: 1.0, speedMult: 1.0 };

/** 파일별 렌더 크기 보정 — 원본 캔버스 크기(1080/1000/500)가 달라 보이는 키가 제각각인 것 정규화. */
const FILE_SCALE: Record<string, number> = {
  "/lottie/walking-6.json": 1.28, // 오피스맨(1000px) — 작게 나와 키움
  "/lottie/walking-5.json": 1.35, // 할아버지(Popeye) — 작게 보여 키움
  "/lottie/walking-7.json": 1.5, // 할머니(500px) — 작게 보여 키움
};

/** 파일별 재생 속도 보정 — 원본 애니메이션 사이클 길이가 달라 걷는 속도가 제각각인 것 정규화. */
const FILE_SPEED: Record<string, number> = {
  "/lottie/walking-7.json": 1.6, // 노인 여성: 사이클 150프레임(5초) → 느린 걸음으로 보정
};

/**
 * 파일별 '발밑 여백' 비율 — 캔버스(정사각) 안에서 캐릭터 발 아래 빈 공간이 차지하는 비율.
 * 88×112 박스에 정사각 캔버스가 들어가며 캐릭터가 뜨는 정도가 파일마다 달라, 같은 bottom이어도
 * 발 높이가 어긋나 z-순서와 시각적 깊이가 불일치(예: 할머니가 뒤로 보이는데 앞사람을 덮음).
 * 실측(canvas alpha 하단 경계)값. 이 여백만큼 아래로 내려 모든 발을 같은 지면선에 정렬한다.
 */
const FILE_FOOT_PAD: Record<string, number> = {
  "/lottie/walking.json": 0.108,
  "/lottie/walking-2.json": 0.207,
  "/lottie/walking-3.json": 0.12,
  "/lottie/walking-4.json": 0.207,
  "/lottie/walking-5.json": 0.183, // 뽀빠이 할아버지
  "/lottie/walking-6.json": 0.259, // 오피스맨
  "/lottie/walking-7.json": 0.298, // 할머니(보행보조기) — 여백 최대
};
const FOOT_BASE_PAD = 0.108; // 기준(기본 남성). 이 값 대비 초과 여백만큼 캐릭터를 내려 정렬.
const FOOT_BOX_H = 112; // DotLottie 박스 높이(px, scale 전)

/** 타임랩스 종료 시점 보장 최소 폐업 점포 수. */
const SCENARIO_MIN_CLOSED: Record<AtmoScenario, number> = { high: 1, mid: 2, low: 3 };

const SCENARIO = {
  high: { title: "잘풀린 미래", mood: "활기찬 상권", count: 16, lit: 0.65, street: "var(--color-border-strong)", accent: "var(--color-green)", desc: "사람이 북적이는 미래 — 유동인구가 몰립니다." },
  mid:  { title: "보통 미래",   mood: "무난한 상권", count: 9,  lit: 0.4,  street: "var(--color-border)", accent: "var(--series-1)", desc: "평소 수준의 미래 — 꾸준한 발걸음." },
  low:  { title: "안풀린 미래", mood: "한산한 상권", count: 4,  lit: 0.15, street: "var(--color-faint)", accent: "var(--color-red)", desc: "발길이 뜸한 미래 — 거리가 비어갑니다." },
} as const;

const SCENE_COLORS = {
  overlay: "color-mix(in srgb, var(--series-2) 72%, transparent)",
  modalShadow: "0 20px 60px color-mix(in srgb, var(--series-2) 30%, transparent)",
  skyDay: "linear-gradient(var(--series-4-bg), var(--color-surface))",
  skyNight: "var(--series-2)",
  skylineDay: "linear-gradient(var(--series-4), var(--series-1-bg))",
  skylineNight: "linear-gradient(var(--series-2), var(--color-primary-dark))",
  cloudStrong: "color-mix(in srgb, var(--color-surface) 90%, transparent)",
  cloudSoft: "color-mix(in srgb, var(--color-surface) 72%, transparent)",
  sun: "var(--color-amber)",
  sunGlow: "0 0 18px color-mix(in srgb, var(--color-amber) 55%, transparent)",
  moon: "var(--color-primary-light)",
  moonGlow: "0 0 12px color-mix(in srgb, var(--color-primary-light) 55%, transparent)",
  streetEnd: "var(--color-bg)",
  glassOnDay: "var(--color-gold-bg)",
  glassOnNight: "var(--color-amber)",
  glassOffDay: "var(--color-primary-soft)",
  glassOffNight: "var(--color-primary-dark)",
  doorDay: "var(--color-muted)",
  doorNight: "var(--series-2)",
  stampBg: "var(--color-surface)",
  hudBg: "color-mix(in srgb, var(--series-2) 72%, transparent)",
  hudText: "var(--color-faint)",
  hudStrong: "var(--color-primary-light)",
  hudBase: "var(--color-muted)",
  traffic: "var(--color-accent)",
  femaleMarker: "color-mix(in srgb, var(--color-red) 85%, transparent)",
  maleMarker: "color-mix(in srgb, var(--series-1) 82%, transparent)",
  nightChipBg: "color-mix(in srgb, var(--series-1) 18%, transparent)",
  dayChipBg: "color-mix(in srgb, var(--color-amber) 18%, transparent)",
} as const;

interface Person {
  id: number;
  color: string;
  bag: boolean;
  row: number;
  /** 연령 버킷 이름 (AGE_STYLE 키). weightedAge 기반으로 결정적 배정. */
  ageBucket: string;
  /** true = 여성 인상(hue/brightness 필터 보정). 인덱스 기반 결정적. scaleX에 관여하지 않음. */
  isFemale: boolean;
  /** true = 외국인(갈색 피부톤 파일 배정). 인덱스 기반 결정적. */
  isForeigner: boolean;
  /** 사용할 Lottie 파일 경로. (isForeigner, isFemale) 조합으로 배정. */
  lottieFile: string;
}

/**
 * "2025-Q4" → {year:2025, q:4} 파싱. 실패 시 null.
 */
function parseQuarter(s: string): { year: number; q: number } | null {
  const m = s.match(/^(\d{4})-Q([1-4])$/);
  if (!m) return null;
  return { year: parseInt(m[1]), q: parseInt(m[2]) };
}

/**
 * {year, q} + offset → "YYYY QN분기" 문자열.
 */
function quarterLabel(base: { year: number; q: number }, offset: number): string {
  const total = (base.q - 1) + offset;
  const y = base.year + Math.floor(total / 4);
  const q = (total % 4) + 1;
  return `${y} Q${q}`;
}

export default function AtmosphereSimulation({
  scenario, ageDistribution, survivalPct, footTraffic,
  dayDominant, daySalesPct, foreignerPct, startQuarter, onClose,
}: Props) {
  const isDay = dayDominant === true;
  const cfg = SCENARIO[scenario];

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const litRatioFinal = survivalPct != null ? clamp(survivalPct / 100, 0.05, 1) : cfg.lit;
  const trafficBase =
    footTraffic != null && footTraffic > 0 ? clamp((Math.log10(footTraffic) - 3.5) * 5, 4, 20) : null;
  const scenarioMult = scenario === "high" ? 1.35 : scenario === "low" ? 0.6 : 1;
  const count = trafficBase != null ? clamp(Math.round(trafficBase * scenarioMult), 3, 24) : cfg.count;
  const realBased = survivalPct != null || (footTraffic != null && footTraffic > 0);
  const [playing, setPlaying] = useState(true);

  // ── 타임랩스 상태 ──────────────────────────────────────────────────────────
  // quarterIdx: 0~TIMELAPSE_QUARTERS (0=시작, 4=완료 후 루프 대기)
  const [quarterIdx, setQuarterIdx] = useState(0);
  // liveRate: 현재 표시 생존율(100% → survivalPct 까지 하강)
  const [liveRate, setLiveRate] = useState(100.0);
  // liveLit: 현재 표시 litRatio(타임랩스 진행에 따라 보간)
  const [liveLit, setLiveLit] = useState(1.0);
  // liveTraffic: 유동인구 라이브 흔들림
  const [liveTraffic, setLiveTraffic] = useState(footTraffic ?? null);

  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 타임랩스 한 사이클: 0분기차 → 4분기차 → pause → 루프 */
  const startCycle = () => {
    const targetRate = survivalPct ?? cfg.lit * 100;
    const totalMs = TIMELAPSE_QUARTERS * TIMELAPSE_QUARTER_MS;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / totalMs, 1); // 0→1 진행도
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      const rate = 100 - (100 - targetRate) * eased;
      const lit  = 1  - (1 - litRatioFinal) * eased;
      const qIdx = Math.min(Math.floor(t * TIMELAPSE_QUARTERS), TIMELAPSE_QUARTERS);

      setLiveRate(parseFloat(rate.toFixed(1)));
      setLiveLit(lit);
      setQuarterIdx(qIdx);

      // 유동인구 라이브 흔들림: ±3% 범위
      if (footTraffic != null) {
        const jitter = 1 + (Math.sin(now / 800) * 0.03);
        setLiveTraffic(Math.round(footTraffic * jitter));
      }

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        // 완료 → pause 후 루프
        timerRef.current = setTimeout(() => {
          setQuarterIdx(0);
          setLiveRate(100);
          setLiveLit(1);
          if (footTraffic != null) setLiveTraffic(footTraffic);
          startCycle();
        }, TIMELAPSE_PAUSE_MS);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  };

  const stopCycle = () => {
    if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (timerRef.current != null) { clearTimeout(timerRef.current); timerRef.current = null; }
  };

  useEffect(() => {
    if (playing) {
      startCycle();
    } else {
      stopCycle();
    }
    return stopCycle;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, survivalPct, footTraffic]);

  // 분기 라벨 계산
  const parsedBase = startQuarter ? parseQuarter(startQuarter) : null;
  const quarterLabel_ = (offset: number) =>
    parsedBase ? quarterLabel(parsedBase, offset) : `${offset + 1}분기차`;

  // ── 폐업 수 계산 (100곳 기준) ─────────────────────────────────────────────
  const closedCount = Math.round((100 - liveRate));

  // ── Lottie 파일 감지 ───────────────────────────────────────────────────────
  const [lottieFiles, setLottieFiles] = useState<string[]>([]);
  const useLottie = lottieFiles.length > 0;

  useEffect(() => {
    let alive = true;
    const checkFile = (path: string): Promise<string | null> =>
      fetch(path, { method: "HEAD" })
        .then((r) => {
          const isJson = (r.headers.get("content-type") ?? "").includes("json");
          return r.ok && isJson ? path : null;
        })
        .catch(() => null);

    checkFile(CROWD_LOTTIE_BASE).then(async (base) => {
      if (!alive || !base) return;
      const found: string[] = [base];
      for (let v = 2; v <= LOTTIE_VARIANT_MAX; v++) {
        const path = `/lottie/walking-${v}.json`;
        const result = await checkFile(path);
        if (result) found.push(result);
        else break;
      }
      if (alive) setLottieFiles(found);
    });
    return () => { alive = false; };
  }, []);

  const players = useRef<(DotLottie | null)[]>([]);
  useEffect(() => {
    players.current.forEach((p) => {
      if (!p) return;
      if (playing) p.play(); else p.pause();
    });
  }, [playing, useLottie]);

  // ── 연령 분포 ──────────────────────────────────────────────────────────────
  const isReal = !!(ageDistribution && ageDistribution.length > 0);
  const ages = useMemo(() => {
    const base = isReal ? ageDistribution! : AGE_FALLBACK;
    return base.map((a, i) => ({ ...a, color: AGE_COLORS[a.name] ?? PALETTE[i % PALETTE.length] }));
  }, [ageDistribution, isReal]);

  const weightedAge = useMemo(() => {
    const total = ages.reduce((s, a) => s + a.pct, 0) || 1;
    return (rnd: number): string => {
      let acc = 0;
      for (const a of ages) { acc += a.pct / total; if (rnd <= acc) return a.color; }
      return ages[ages.length - 1]?.color ?? "var(--series-1)";
    };
  }, [ages]);

  const weightedAgeBucket = useMemo(() => {
    const base = isReal ? ageDistribution! : AGE_FALLBACK;
    const total = base.reduce((s, a) => s + a.pct, 0) || 1;
    return (rnd: number): string => {
      let acc = 0;
      for (const a of base) { acc += a.pct / total; if (rnd <= acc) return a.name; }
      return base[base.length - 1]?.name ?? "40대";
    };
  }, [ageDistribution, isReal]);

  const foreignerThreshold = (foreignerPct != null ? foreignerPct : 8) / 100;

  const people = useMemo<Person[]>(() => {
    const out: Person[] = [];
    const f = (idx: number) => lottieFiles[idx] ?? lottieFiles[0] ?? CROWD_LOTTIE_BASE;
    const hasVariants = lottieFiles.length >= 2;
    for (let i = 0; i < count; i++) {
      // 배수를 크게 해 인덱스가 커질 때 값이 골고루 섞이게(9301은 작아서 앞 인덱스가 단조증가 → 노인 편중 누락).
      const r  = ((i * 90001 + 49297) % 233280) / 233280;
      const r2 = ((i * 4021 + 3571) % 100) / 100;
      const r3 = ((i * 1777 + 7919) % 997) / 997;
      const r4 = ((i * 6271 + 1031) % 883) / 883;
      const ageBucket = weightedAgeBucket(r);
      const isFemale = r3 < 0.5;
      const isForeigner = r4 < foreignerThreshold;
      let lottieFile: string;
      if (!hasVariants) {
        lottieFile = f(0);
      } else if (ageBucket === "50대" || ageBucket === "60대+" || ageBucket === "60대이상") {
        // 노인 전용 애니메이션 (50대 이상). 여성=보행보조기 할머니(f6), 남성=할아버지(f4).
        lottieFile = isFemale ? f(6) : f(4);
      } else if (!isFemale && (ageBucket === "30대" || ageBucket === "40대")) {
        // 직장인 나이대 남성 → 오피스맨 (국적 무관)
        lottieFile = f(5);
      } else if (isForeigner) {
        lottieFile = isFemale ? f(3) : f(2);
      } else {
        lottieFile = isFemale ? f(1) : f(0);
      }      out.push({ id: i, color: weightedAge(r), bag: r2 > 0.55, row: (i % 5) / 4, ageBucket, isFemale, isForeigner, lottieFile });
    }
    return out;
  }, [count, weightedAge, weightedAgeBucket, lottieFiles, foreignerThreshold]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const shops = Array.from({ length: 7 });
  const shopCount = shops.length;
  // finalClosed: 타임랩스 종료 시점 폐업 수 = max(시나리오 최소값, 생존율 기반 계산값).
  const minClosed = SCENARIO_MIN_CLOSED[scenario];
  const survivalBasedClosed = shopCount - Math.floor(shopCount * litRatioFinal);
  const finalClosed = Math.max(minClosed, survivalBasedClosed);
  // progress: 타임랩스 진행률 (liveLit 1.0→목표 구간에서 0→1).
  // liveLit >= 1 이면 반드시 0 → 시작 시 전부 영업.
  const litProgress = liveLit >= 1 ? 0 : Math.min(1, (1 - liveLit) / Math.max(0.001, 1 - litRatioFinal));
  // currentClosed: 현재 폐업 수. progress=0 → 0곳, progress=1 → finalClosed곳.
  const currentClosed = Math.round(litProgress * finalClosed);
  const litCount = shopCount - currentClosed;
  // 꺼지는 순서: (i*5+2)%7 순열로 결정적 섞기 — litCount보다 높은 순위 점포가 꺼짐.
  const SHOP_ORDER: number[] = Array.from({ length: shopCount }, (_, i) => (i * 5 + 2) % shopCount);
  // shopOn[i] = 이 점포가 켜져 있는지 (litCount개 점포만 영업)
  const shopOn: boolean[] = Array(shopCount).fill(false);
  SHOP_ORDER.slice(0, litCount).forEach((idx) => { shopOn[idx] = true; });

  const playState = playing ? "running" : "paused";
  const AWNING = [
    "var(--series-7)",
    "var(--series-6)",
    "var(--series-1)",
    "var(--series-5)",
    "var(--series-4)",
    "var(--color-gold)",
    "var(--color-red)",
  ];
  const STARS: [number, number][] = [
    [8, 20], [17, 42], [25, 14], [34, 32], [45, 22], [53, 46],
    [62, 16], [71, 36], [79, 24], [88, 44], [93, 18], [40, 54],
  ];

  // HUD 색상: 생존율이 낮을수록 붉어짐
  const hudRateColor = liveRate >= 80 ? "var(--color-green)" : liveRate >= 60 ? "var(--color-amber)" : "var(--color-red)";

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: SCENE_COLORS.overlay, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, fontFamily: '"Apple SD Gothic Neo","Pretendard","Noto Sans KR",sans-serif' }}
    >
      <style>{`
        @keyframes atmo-bob  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
        @keyframes atmo-glow { 0%,100%{opacity:.5} 50%{opacity:.85} }
        @keyframes atmo-walk-r { from{left:-8%} to{left:108%} }
        @keyframes atmo-walk-l { from{left:108%} to{left:-8%} }
        @keyframes atmo-stamp { 0%{transform:scale(1.6) rotate(var(--rot));opacity:0} 60%{opacity:1} 100%{transform:scale(1) rotate(var(--rot));opacity:1} }
      `}</style>

      <div onClick={(e) => e.stopPropagation()} style={{ width: 560, background: "var(--color-surface)", borderRadius: 18, padding: "20px 22px", boxShadow: SCENE_COLORS.modalShadow }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--color-muted)" }}>상권 분위기 시뮬레이션</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: cfg.accent, marginTop: 2 }}>
              {cfg.title} <span style={{ color: "var(--color-text)", fontWeight: 700 }}>· {cfg.mood}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setPlaying((p) => !p)} style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)", borderRadius: 8, padding: "6px 12px", fontSize: 13, cursor: "pointer" }}>
              {playing ? "⏸ 정지" : "▶ 재생"}
            </button>
            <button onClick={onClose} style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)", borderRadius: 8, width: 32, cursor: "pointer", fontSize: 15 }}>✕</button>
          </div>
        </div>

        {/* 낮/밤 칩 */}
        {dayDominant != null && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 10, padding: "4px 10px", borderRadius: 20, background: isDay ? SCENE_COLORS.dayChipBg : SCENE_COLORS.nightChipBg, fontSize: 12, color: isDay ? "var(--color-gold)" : "var(--series-1)" }}>
            {isDay
              ? `☀️ 낮 매출${daySalesPct != null ? ` ${daySalesPct.toFixed(1)}%` : ""} — 낮이 유리한 상권`
              : `🌙 밤 매출${daySalesPct != null ? ` ${daySalesPct.toFixed(1)}%` : ""} — 밤이 유리한 상권`}
          </div>
        )}

        <div style={{ position: "relative", height: 300, marginTop: 14, borderRadius: 14, overflow: "hidden", background: isDay ? SCENE_COLORS.skyDay : SCENE_COLORS.skyNight }}>
          {/* 낮 테마: 해 */}
          {isDay && (
            <div style={{ position: "absolute", top: 14, right: 18, width: 26, height: 26, borderRadius: "50%", background: SCENE_COLORS.sun, boxShadow: SCENE_COLORS.sunGlow, zIndex: 5 }} />
          )}

          {/* 상가 영역 */}
          <div style={{ position: "absolute", inset: 0, height: "45%", overflow: "hidden", background: isDay ? SCENE_COLORS.skylineDay : SCENE_COLORS.skylineNight }}>
            {isDay ? (
              <>
                <div style={{ position: "absolute", top: "20%", left: "12%", width: 56, height: 16, borderRadius: 20, background: SCENE_COLORS.cloudStrong, filter: "blur(1px)" }} />
                <div style={{ position: "absolute", top: "40%", left: "58%", width: 42, height: 13, borderRadius: 20, background: SCENE_COLORS.cloudSoft, filter: "blur(1px)" }} />
              </>
            ) : (
              <>
                <div style={{ position: "absolute", top: 12, right: 22, width: 20, height: 20, borderRadius: "50%", background: SCENE_COLORS.moon, boxShadow: SCENE_COLORS.moonGlow }} />
                {STARS.map(([l, t], i) => (
                  <div key={i} style={{ position: "absolute", left: `${l}%`, top: `${t}%`, width: 2, height: 2, borderRadius: "50%", background: "var(--color-surface)", opacity: 0.85, animation: `atmo-glow ${2 + (i % 3)}s ease-in-out ${i * 0.2}s infinite`, animationPlayState: playState }} />
                ))}
              </>
            )}
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "58%", display: "flex", alignItems: "stretch", gap: 6, padding: "0 14px" }}>
              {shops.map((_, i) => {
                const on = shopOn[i] ?? false;
                const awning = AWNING[i % AWNING.length];
                const glass = on ? (isDay ? SCENE_COLORS.glassOnDay : SCENE_COLORS.glassOnNight) : isDay ? SCENE_COLORS.glassOffDay : SCENE_COLORS.glassOffNight;
                const door = isDay ? SCENE_COLORS.doorDay : SCENE_COLORS.doorNight;
                // 팻말 기울기: 인덱스 기반 결정적 (-6~+6deg)
                const rot = ((i * 137 + 42) % 13) - 6;
                return (
                  <div key={i} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                    {/* 차양: 폐업 시 채도·불투명도 죽임 */}
                    <div style={{ height: 16, background: awning, borderRadius: "4px 4px 0 0", boxShadow: on ? `0 0 8px ${awning}` : "none", filter: on ? "none" : "grayscale(0.85)", opacity: on ? 1 : 0.45 }} />
                    {/* 통유리 */}
                    <div style={{ flex: 1, position: "relative", background: glass, opacity: on ? 1 : 0.6, borderLeft: "1px solid color-mix(in srgb, var(--series-2) 12%, transparent)", borderRight: "1px solid color-mix(in srgb, var(--series-2) 12%, transparent)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                      <div style={{ width: "46%", height: "48%", background: door, borderRadius: "3px 3px 0 0", borderLeft: "1px solid color-mix(in srgb, var(--color-surface) 14%, transparent)" }} />
                      {/* 폐업 팻말: 불이 꺼진 점포에만 표시, 쾅 스탬프 애니메이션 */}
                      {!on && (
                        <div style={{
                          position: "absolute", top: "50%", left: "50%",
                          transform: `translate(-50%,-50%) scale(1) rotate(${rot}deg)`,
                          // CSS 변수로 rotate 값을 keyframe에 전달
                          ["--rot" as string]: `${rot}deg`,
                          animation: "atmo-stamp 0.25s ease-out both",
                          animationPlayState: playState,
                          background: SCENE_COLORS.stampBg,
                          border: "1.5px solid var(--color-red)",
                          borderRadius: 3,
                          padding: "2px 4px",
                          textAlign: "center",
                          whiteSpace: "nowrap",
                          zIndex: 2,
                        }}>
                          <div style={{ fontSize: 7, fontWeight: 800, color: "var(--color-red)", letterSpacing: "0.03em", lineHeight: 1.3 }}>임대</div>
                          <div style={{ fontSize: 6, fontWeight: 700, color: "var(--color-red)", letterSpacing: "0.02em", lineHeight: 1.3 }}>문의</div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 거리 */}
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "56%", background: `linear-gradient(${cfg.street}, ${SCENE_COLORS.streetEnd})` }} />

          {/* 게임 HUD 패널 — 씬 좌상단 */}
          <div style={{
            position: "absolute", top: 8, left: 8, zIndex: 20,
            background: SCENE_COLORS.hudBg, backdropFilter: "blur(4px)",
            borderRadius: 8, padding: "7px 11px", display: "flex", flexDirection: "column", gap: 3,
            fontFamily: '"SF Mono","JetBrains Mono","Consolas",monospace',
          }}>
            <div style={{ fontSize: 11, color: SCENE_COLORS.hudText, letterSpacing: "0.04em" }}>
              분기 &nbsp;<span style={{ color: SCENE_COLORS.hudStrong, fontWeight: 700 }}>{quarterLabel_(quarterIdx)}</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, color: hudRateColor, letterSpacing: "0.02em" }}>
              생존율 &nbsp;{liveRate.toFixed(1)}%
            </div>
            <div style={{ fontSize: 11, color: SCENE_COLORS.hudText }}>
              폐업 &nbsp;<span style={{ color: closedCount > 10 ? "var(--color-red)" : SCENE_COLORS.hudStrong, fontWeight: 600 }}>{closedCount}곳</span>
              <span style={{ color: SCENE_COLORS.hudBase }}> / 100곳 기준</span>
            </div>
            {liveTraffic != null && (
              <div style={{ fontSize: 11, color: SCENE_COLORS.hudText }}>
                유동인구 &nbsp;<span style={{ color: SCENE_COLORS.traffic, fontWeight: 600 }}>{liveTraffic.toLocaleString()}명/h</span>
              </div>
            )}
          </div>

          {/* 군중 */}
          {useLottie
            ? people.slice(0, Math.min(people.length, 12)).map((p, i) => {
                const ageStyle = AGE_STYLE[p.ageBucket] ?? AGE_STYLE_FALLBACK;
                const rowScale = 0.62 + p.row * 0.5;
                const rawScale = rowScale * ageStyle.scaleBonus * (FILE_SCALE[p.lottieFile] ?? 1);
                // 오피스맨은 최소 크기 하한을 둬(현재 최소의 약 2배) 뒷줄에서도 작게 안 보이게.
                const scale = p.lottieFile === "/lottie/walking-6.json" ? Math.max(rawScale, 1.28) : rawScale;
                const bottom = 4 + (1 - p.row) * 52; // row 클수록(=큰/가까운) 화면 아래(앞)
                const dir = i % 2 === 0 ? 1 : -1;
                const baseDur = 9 + (i % 6) * 2.2;
                const dur = baseDur / ageStyle.speedMult;
                const walkAnim = dir === 1 ? "atmo-walk-r" : "atmo-walk-l";
                const hueExtra = p.isFemale ? 5 : 0;
                const brightnessExtra = p.isFemale ? 0.04 : 0;
                const cssFilter = `hue-rotate(${ageStyle.hueRotate + hueExtra}deg) saturate(${ageStyle.saturate}) brightness(${ageStyle.brightness + brightnessExtra})`;
                const scaleXDir = dir * (FILE_FACING[p.lottieFile] ?? LOTTIE_FACING);
                // 발밑 여백 정렬: 기준(기본 남성) 대비 초과 여백만큼 아래로 내려 모든 발을 같은 지면선에 맞춤.
                const footNudge = Math.max(0, (FILE_FOOT_PAD[p.lottieFile] ?? 0.12) - FOOT_BASE_PAD) * FOOT_BOX_H;
                const charH = 112 * scale;
                const markerSize = Math.max(14, 15 * scale);
                const markerBottom = charH + footNudge + 2;
                return (
                  <div
                    key={p.id}
                    data-lf={p.lottieFile}
                    style={{ position: "absolute", bottom, zIndex: Math.round(p.row * 1000) + i, animation: `${walkAnim} ${dur}s linear ${-(i * 1.7)}s infinite`, animationPlayState: playState }}
                  >
                    {/* 성별 마커 — scaleX 뒤집힘 영향 밖에 배치 */}
                    <div
                      aria-label={p.isFemale ? "여성" : "남성"}
                      style={{
                        position: "absolute",
                        bottom: markerBottom,
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: markerSize,
                        height: markerSize,
                        borderRadius: "50%",
                        background: p.isFemale ? SCENE_COLORS.femaleMarker : SCENE_COLORS.maleMarker,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: Math.max(10, 11 * scale),
                        color: "var(--color-on-primary)",
                        lineHeight: 1,
                        pointerEvents: "none",
                        zIndex: 1,
                      }}
                    >
                      {p.isFemale ? "♀" : "♂"}
                    </div>
                    <div style={{ transform: `scale(${scale}) scaleX(${scaleXDir}) translateY(${footNudge}px)`, transformOrigin: "bottom center", display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <DotLottieReact
                        src={p.lottieFile}
                        loop
                        autoplay={playing}
                        speed={(FILE_SPEED[p.lottieFile] ?? 1) * ageStyle.speedMult}
                        dotLottieRefCallback={(inst) => {
                          players.current[i] = inst;
                          if (inst) inst.setSpeed((FILE_SPEED[p.lottieFile] ?? 1) * ageStyle.speedMult);
                        }}
                        style={{ width: 88, height: 112, filter: cssFilter }}
                      />
                    </div>
                  </div>
                );
              })
            : people.map((p, i) => {
                const scale = 0.62 + p.row * 0.5;
                const bottom = 14 + (1 - p.row) * 96; // row 클수록(=큰/가까운) 화면 아래(앞)
                const dir = i % 2 === 0 ? 1 : -1;
                const dur = 9 + (i % 6) * 2.2;
                const walkAnim = dir === 1 ? "atmo-walk-r" : "atmo-walk-l";
                const dotH = (13 + 1 + 24) * scale;
                return (
                  <div key={p.id} style={{ position: "absolute", bottom, zIndex: Math.round(p.row * 1000) + i, animation: `${walkAnim} ${dur}s linear ${-(i * 1.7)}s infinite`, animationPlayState: playState }}>
                    {/* 성별 마커 */}
                    <div
                      aria-label={p.isFemale ? "여성" : "남성"}
                      style={{
                        position: "absolute",
                        bottom: dotH + 2,
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: 14,
                        height: 14,
                        borderRadius: "50%",
                        background: p.isFemale ? SCENE_COLORS.femaleMarker : SCENE_COLORS.maleMarker,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        color: "var(--color-on-primary)",
                        lineHeight: 1,
                        pointerEvents: "none",
                      }}
                    >
                      {p.isFemale ? "♀" : "♂"}
                    </div>
                    <div style={{ transform: `scale(${scale}) scaleX(${dir})`, transformOrigin: "bottom center" }}>
                      <div style={{ animation: `atmo-bob ${1.6 + (i % 3) * 0.3}s ease-in-out infinite`, animationPlayState: playState, display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <div style={{ width: 13, height: 13, borderRadius: "50%", background: p.color }} />
                        <div style={{ width: 20, height: 24, borderRadius: "9px 9px 5px 5px", background: p.color, marginTop: 1, position: "relative" }}>
                          {p.bag && <div style={{ position: "absolute", right: -6, bottom: 2, width: 9, height: 11, borderRadius: 2, background: "var(--series-2)" }} />}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
        </div>

        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12, color: "var(--color-text-body)", marginBottom: 6 }}>유동인구 예상 연령 분포</div>
          <div style={{ display: "flex", height: 10, borderRadius: 6, overflow: "hidden" }}>
            {ages.map((a) => (
              <div key={a.name} style={{ width: `${a.pct}%`, background: a.color }} />
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginTop: 8 }}>
            {ages.map((a) => (
              <span key={a.name} style={{ fontSize: 12, color: "var(--color-text-body)", display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: a.color }} /> {a.name} {a.pct}%
              </span>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 6 }}>
            {isReal ? "연령 구성비 · 최근 관측 실데이터" : "※ 연령 구성비 · 예시(관측 데이터 없음)"}
          </div>
        </div>

        <div style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10 }}>{cfg.desc}</div>
        {realBased && (
          <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 4 }}>
            점포 불빛 = 분기별 누적 생존율 진행
            {footTraffic != null && footTraffic > 0
              ? dayDominant != null ? " · 인원 = 낮/밤 시간대 유동인구 기반" : " · 인원 = 평균 유동인구 기반"
              : ""}
          </div>
        )}
      </div>
    </div>
  );
}
