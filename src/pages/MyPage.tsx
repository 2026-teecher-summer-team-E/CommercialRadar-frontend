import { useEffect, useRef, useState } from "react";
import type {
  UserMe,
  UserStats,
  ReportListItem,
  InterestDistrict,
} from "../types";
import { meApi } from "../services/meApi";
import { reportsApi } from "../services/reportsApi";
import { interestApi } from "../services/interestApi";
import { commercialApi } from "../services/commercialApi";
import { formatJoinDate, initialOf } from "../components/mypage/format";
import ReportCard from "../components/mypage/ReportCard";
import InterestCard from "../components/mypage/InterestCard";
import EmptyState from "../components/mypage/EmptyState";
import listStyles from "../components/mypage/mypage.module.css";
import styles from "./MyPage.module.css";
import { useAuth, clerkEnabled } from "../lib/auth";

type TabKey = "reports" | "interests" | "shared";

const REPORTS_LIMIT = 20;

/**
 * compare API(한 번에 2~5개 id 허용)에 맞춰 id 목록을 청크로 나눈다.
 * 마지막에 1개만 남으면 앞 청크의 마지막 id를 겹쳐 2개로 만들고(결과는 Map 으로 dedup 되어 무해),
 * 전체가 1개뿐이면 임의의 동반 id 를 붙여 최소 2개를 만든다.
 */
function buildCompareChunks(ids: number[]): number[][] {
  if (ids.length === 0) return [];
  if (ids.length === 1) return [[ids[0], ids[0] === 1 ? 2 : 1]];
  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += 5) {
    const chunk = ids.slice(i, i + 5);
    if (chunk.length === 1) chunk.unshift(ids[i - 1]); // 마지막 1개 → 앞 id 겹쳐 2개
    chunks.push(chunk);
  }
  return chunks;
}

export default function MyPage() {
  const { signOut } = useAuth();
  const [user, setUser] = useState<UserMe | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [interests, setInterests] = useState<InterestDistrict[]>([]);
  const [interestsLoaded, setInterestsLoaded] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<TabKey>("interests");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [busyInterestId, setBusyInterestId] = useState<number | null>(null);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  // 마운트 시 me / stats / reports 병렬 fetch
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(false);

    Promise.allSettled([meApi.me(), meApi.stats(), reportsApi.list({ page: 1, limit: REPORTS_LIMIT })])
      .then(([meRes, statsRes, reportsRes]) => {
        if (!alive) return;
        if (meRes.status === "fulfilled") setUser(meRes.value.data);
        if (statsRes.status === "fulfilled") setStats(statsRes.value.data);
        if (reportsRes.status === "fulfilled") setReports(reportsRes.value.data.reports ?? []);
        // me 조회 실패는 페이지가 성립하지 않으므로 에러 처리
        if (meRes.status === "rejected") setError(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  // 관심 상권 탭 최초 진입 시 lazy fetch
  useEffect(() => {
    if (tab !== "interests" || interestsLoaded) return;
    let alive = true;
    interestApi
      .list()
      .then(async (r) => {
        const list = r.data ?? [];
        if (list.length === 0) {
          if (alive) setInterests([]);
          return;
        }
        // 랭킹 페이지처럼 compare API로 상권 이름을 채운다.
        // compare 는 한 번에 2~5개만 허용하므로, 청크마다 최소 2개를 보장한다.
        // (관심 상권이 1개거나 개수가 5n+1 이면 마지막 청크가 1개가 되어 호출이 실패함)
        const ids = [...new Set(list.map((it) => it.commercial_district_id))];
        const chunks = buildCompareChunks(ids);
        const nameById = new Map<number, string>();
        // allSettled: 한 청크가 실패해도 나머지 이름은 채운다.
        const resArr = await Promise.allSettled(chunks.map((c) => commercialApi.compare(c)));
        resArr.forEach((res) => {
          if (res.status === "fulfilled")
            res.value.data.districts.forEach((d) => nameById.set(d.id, d.district_name));
        });
        if (alive)
          setInterests(
            list.map((it) => ({
              ...it,
              district_name: nameById.get(it.commercial_district_id) ?? it.district_name,
            })),
          );
      })
      .catch(() => {
        /* 방어적: 실패해도 빈 상태 유지 */
      })
      .finally(() => {
        if (alive) setInterestsLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [tab, interestsLoaded]);

  // 모달 열릴 때 취소 버튼에 포커스, ESC 로 닫기
  useEffect(() => {
    if (!showSignOutModal) return;
    cancelBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowSignOutModal(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showSignOutModal]);

  const handleShare = (id: number) => {
    setBusyId(id);
    reportsApi
      .share(id)
      .catch(() => {
        /* 공유 실패는 조용히 무시 */
      })
      .finally(() => setBusyId(null));
  };

  const handleMemoSave = (id: number, memo: string | null) => {
    setBusyInterestId(id);
    const prev = interests;
    // 낙관적 갱신
    setInterests((list) => list.map((it) => (it.id === id ? { ...it, memo } : it)));
    interestApi
      .update(id, { memo })
      .catch(() => {
        setInterests(prev); // 실패 시 롤백
      })
      .finally(() => setBusyInterestId(null));
  };

  const handleRemove = (id: number) => {
    setBusyId(id);
    const prev = reports;
    setReports((rs) => rs.filter((r) => r.id !== id)); // 낙관적 제거
    reportsApi
      .remove(id)
      .then(() => {
        setStats((s) =>
          s ? { ...s, saved_reports: Math.max(0, s.saved_reports - 1) } : s,
        );
      })
      .catch(() => {
        setReports(prev); // 롤백
      })
      .finally(() => setBusyId(null));
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.state}>내 정보를 불러오고 있어요…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.state}>
          정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
        </div>
      </div>
    );
  }

  const name = user?.name ?? "게스트";
  const savedCount = stats?.saved_reports ?? reports.length;
  const interestCount = stats?.interest_districts ?? 0;
  const sharedCount = stats?.shared_reports ?? 0;

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "interests", label: "관심 상권", count: interestCount },
    { key: "reports", label: "저장된 리포트", count: savedCount },
    { key: "shared", label: "공유된 리포트", count: sharedCount },
  ];

  return (
    <div className={styles.page}>
      {/* 1. 페이지 타이틀 */}
      <header className={styles.header}>
        <h1 className={styles.title}>마이페이지</h1>
        <p className={styles.subtitle}>
          저장한 리포트와 관심 상권을 관리하세요
        </p>
      </header>

      {/* 2. 프로필 히어로 카드 */}
      <section className={styles.hero}>
        <div className={styles.heroTop}>
          <span className={styles.avatar} aria-hidden="true">
            {initialOf(name)}
          </span>
          <div className={styles.heroInfo}>
            <div className={styles.heroNameRow}>
              <span className={styles.heroName}>{name}</span>
              <span
                className={
                  user?.is_company ? styles.badgeCompany : styles.badgeNormal
                }
              >
                {user?.is_company ? "기업 회원" : "일반 회원"}
              </span>
            </div>
            <p className={styles.heroEmail}>{user?.email ?? "이메일 미등록"}</p>
            <p className={styles.heroJoined}>
              {formatJoinDate(user?.created_at)}
            </p>
          </div>
          {clerkEnabled && (
            <button
              type="button"
              className={styles.signOutBtn}
              onClick={() => setShowSignOutModal(true)}
            >
              로그아웃
            </button>
          )}
        </div>

        <div className={styles.statsRow}>
          <div className={styles.statCell}>
            <span className={styles.statNum}>{interestCount}</span>
            <span className={styles.statLabel}>관심 상권</span>
          </div>
          <span className={styles.statDivider} aria-hidden="true" />
          <div className={styles.statCell}>
            <span className={styles.statNum}>{savedCount}</span>
            <span className={styles.statLabel}>저장 리포트</span>
          </div>
          <span className={styles.statDivider} aria-hidden="true" />
          <div className={styles.statCell}>
            <span className={styles.statNum}>{sharedCount}</span>
            <span className={styles.statLabel}>공유한 리포트</span>
          </div>
        </div>
      </section>

      {/* 3. 탭 (세그먼트 컨트롤) */}
      <div className={styles.segment} role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`${styles.segBtn} ${tab === t.key ? styles.segBtnActive : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            <span className={styles.segCount}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* 4/5. 탭 콘텐츠 */}
      <section className={styles.tabContent}>
        {tab === "reports" &&
          (reports.length > 0 ? (
            <ul className={listStyles.list}>
              {reports.map((r, i) => (
                <ReportCard
                  key={r.id}
                  report={r}
                  index={i}
                  onShare={handleShare}
                  onRemove={handleRemove}
                  busy={busyId === r.id}
                />
              ))}
            </ul>
          ) : (
            <EmptyState
              title="저장된 리포트가 아직 없어요"
              description="상권 분석 결과를 리포트로 저장하면 여기에서 모아볼 수 있습니다."
            />
          ))}

        {tab === "interests" &&
          (!interestsLoaded ? (
            <div className={styles.state}>관심 상권 목록을 가져오는 중…</div>
          ) : interests.length > 0 ? (
            <ul className={listStyles.list}>
              {interests.map((item, i) => (
                <InterestCard
                  key={item.id}
                  item={item}
                  index={i}
                  onSaveMemo={handleMemoSave}
                  busy={busyInterestId === item.id}
                />
              ))}
            </ul>
          ) : (
            <EmptyState
              title="아직 찜한 상권이 없어요"
              description="관심 있는 상권을 저장해두면 변화를 빠르게 확인할 수 있습니다."
            />
          ))}

        {tab === "shared" && (
          <EmptyState
            title="공유된 리포트가 아직 없어요"
            description="리포트를 공유하면 공유 링크와 함께 이곳에 모입니다."
          />
        )}
      </section>

      {/* 로그아웃 확인 모달 */}
      {showSignOutModal && (
        <div
          className={styles.modalDim}
          onClick={() => setShowSignOutModal(false)}
          role="presentation"
        >
          <div
            className={styles.modalBox}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="signout-modal-title"
          >
            <h2 id="signout-modal-title" className={styles.modalTitle}>
              로그아웃할까요?
            </h2>
            <p className={styles.modalBody}>
              저장한 리포트와 관심 상권은 그대로 남아 있어요.
            </p>
            <div className={styles.modalActions}>
              <button
                ref={cancelBtnRef}
                type="button"
                className={styles.modalCancelBtn}
                onClick={() => setShowSignOutModal(false)}
              >
                취소
              </button>
              <button
                type="button"
                className={styles.modalSignOutBtn}
                onClick={() => {
                  setShowSignOutModal(false);
                  signOut();
                }}
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
