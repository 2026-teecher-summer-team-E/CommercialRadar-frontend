/**
 * 시뮬레이션(AtmosphereSimulation) Lottie 캐릭터 프리워밍.
 *
 * 시뮬레이션 모달은 열릴 때 비로소 /lottie/walking*.json 을 HEAD 감지 후 GET 하므로
 * 첫 오픈 시 캐릭터가 늦게 뜬다(팝인). 대시보드 유휴 시간에 이 파일들을 미리 fetch 해
 * 브라우저 HTTP 캐시에 적재해두면, 실제 오픈 시 DotLottie 의 GET 이 캐시에서 즉시 해결된다.
 *
 * 파일 목록은 AtmosphereSimulation 의 CROWD_LOTTIE_BASE + walking-2..7 과 동일하게 유지한다.
 */
const LOTTIE_PATHS = [
  "/lottie/walking.json",
  "/lottie/walking-2.json",
  "/lottie/walking-3.json",
  "/lottie/walking-4.json",
  "/lottie/walking-5.json",
  "/lottie/walking-6.json",
  "/lottie/walking-7.json",
];

let warmed = false;

/** 유휴 시점에 Lottie 캐릭터 파일을 캐시에 선반입. 세션당 1회만 실행. */
export function prewarmLottie(): void {
  if (warmed || typeof window === "undefined" || typeof fetch === "undefined") return;
  warmed = true;

  const run = () => {
    for (const path of LOTTIE_PATHS) {
      // 존재하지 않는 변형은 무시(404). 캐시 적재가 목적이라 응답 본문은 소비만 하고 버린다.
      fetch(path, { cache: "force-cache" })
        .then((r) => {
          void r.blob().catch(() => {});
        })
        .catch(() => {});
    }
  };

  const w = window as unknown as { requestIdleCallback?: (cb: () => void) => void };
  if (typeof w.requestIdleCallback === "function") w.requestIdleCallback(run);
  else window.setTimeout(run, 1200);
}
