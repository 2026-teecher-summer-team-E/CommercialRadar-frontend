import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useBelts, useBeltMomentum, queryKeys } from "../hooks/queries";
import { commercialApi } from "../services/commercialApi";
import type { BeltMember, BeltSummary } from "../types";
import PageLoader from "../components/common/PageLoader";
import { fmtGrowth, fmtSales } from "../components/belt/beltFormat";
import styles from "./BeltPage.module.css";

const BeltMap = lazy(() => import("../components/belt/BeltMap"));

/** 성장률 부호에 따른 뱃지 스타일 클래스. */
function growthClass(pct: number | null): string {
  if (pct == null) return styles.badgeFlat;
  if (pct > 0) return styles.badgeUp;
  if (pct < 0) return styles.badgeDown;
  return styles.badgeFlat;
}

/** 기준→최신 분기 라벨. 둘 다 있으면 "2021-Q4 → 2025-Q4". */
function quarterRange(base: string | null, latest: string | null): string {
  if (!base || !latest) return "";
  return `${base} → ${latest}`;
}

function BeltCard({
  belt,
  active,
  onSelect,
}: {
  belt: BeltSummary;
  active: boolean;
  onSelect: (slug: string) => void;
}) {
  return (
    <button
      type="button"
      className={active ? `${styles.beltCard} ${styles.beltCardActive}` : styles.beltCard}
      onClick={() => onSelect(belt.slug)}
      aria-pressed={active}
    >
      <div className={styles.beltCardTop}>
        <span className={styles.beltCardName}>{belt.name}</span>
        <span className={`${styles.badge} ${growthClass(belt.belt_growth_pct)}`}>
          {fmtGrowth(belt.belt_growth_pct)}
        </span>
      </div>
      <div className={styles.beltCardMeta}>
        <span>{belt.anchor_gu ?? "-"}</span>
        <span className={styles.dot}>·</span>
        <span>상권 {belt.member_count}개</span>
      </div>
      {active && (
        <div className={styles.beltCardDetail}>
          <p className={styles.quarterRange}>
            {quarterRange(belt.base_quarter, belt.latest_quarter)} · 같은 분기 대비
          </p>
          <div className={styles.hero}>
            <span className={styles.heroBase}>{fmtSales(belt.belt_sales_base)}</span>
            <span className={styles.heroArrow} aria-hidden>
              →
            </span>
            <span className={styles.heroLatest}>{fmtSales(belt.belt_sales_latest)}</span>
          </div>
        </div>
      )}
    </button>
  );
}

/** 성장/침체 랭킹 리스트(뜨는 곳 / 지는 곳). */
function MemberList({
  title,
  members,
  onSelect,
}: {
  title: string;
  members: BeltMember[];
  onSelect: (id: number) => void;
}) {
  return (
    <div className={styles.rankPanel}>
      <h3 className={styles.rankTitle}>{title}</h3>
      {members.length === 0 ? (
        <p className={styles.empty}>데이터 없음</p>
      ) : (
        <>
          <div className={styles.rankTableHead}>
            <span aria-hidden />
            <span>상권</span>
            <span className={styles.rankHeadSales}>당기 매출</span>
            <span className={styles.rankHeadGrowth}>매출 변동률</span>
          </div>
          <ol className={styles.rankList}>
            {members.map((m, i) => (
              <li key={m.district_id}>
                <button type="button" className={styles.rankItem} onClick={() => onSelect(m.district_id)}>
                  <span className={styles.rankNum}>{i + 1}</span>
                  <span className={styles.rankName}>{m.district_name}</span>
                  <span className={styles.rankSales}>{fmtSales(m.sales_latest)}</span>
                  <span className={`${styles.badge} ${growthClass(m.growth_pct)}`}>{fmtGrowth(m.growth_pct)}</span>
                </button>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

export default function BeltPage() {
  const navigate = useNavigate();
  const beltsQuery = useBelts();
  const belts = useMemo(() => beltsQuery.data ?? [], [beltsQuery.data]);

  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  // 목록 로드 후 첫 벨트를 기본 선택.
  useEffect(() => {
    if (selectedSlug == null && belts.length > 0) setSelectedSlug(belts[0].slug);
  }, [belts, selectedSlug]);

  const momentumQuery = useBeltMomentum(selectedSlug);
  const momentum = momentumQuery.data ?? null;

  // 벨트 멤버가 걸친 자치구들의 상권 경계 GeoJSON을 받아 합본한다(코로플레스 채색용).
  // geojson 엔드포인트는 gu_name 필터만 지원하므로 벨트가 여러 구에 걸치면 구별로 호출한다(가이드 4).
  const memberGuNames = useMemo(() => {
    const set = new Set<string>();
    (momentum?.members ?? []).forEach((m) => m.gu_name && set.add(m.gu_name));
    return [...set].sort();
  }, [momentum]);

  const geojsonQuery = useQuery({
    queryKey: queryKeys.beltGeojson(memberGuNames),
    enabled: memberGuNames.length > 0,
    staleTime: 30 * 60 * 1000,
    queryFn: async (): Promise<GeoJSON.FeatureCollection> => {
      const results = await Promise.all(memberGuNames.map((gu) => commercialApi.geojson({ gu_name: gu })));
      return { type: "FeatureCollection", features: results.flatMap((r) => r.data.features) };
    },
  });
  const beltGeojson = geojsonQuery.data ?? null;

  const goToDistrict = (districtId: number) => navigate(`/dashboard/${districtId}`);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>상권 벨트</h1>
        <p className={styles.subtitle}>
          인접한 유명 상권을 하나의 축(벨트)으로 묶어, 어디가 뜨고 지는지를 비교합니다.
        </p>
      </header>

      {beltsQuery.isLoading ? (
        <PageLoader fullScreen={false} />
      ) : beltsQuery.isError ? (
        <div className={styles.errorBox}>벨트 목록을 불러오지 못했습니다.</div>
      ) : belts.length === 0 ? (
        <div className={styles.errorBox}>표시할 벨트가 없습니다. (백엔드 seed-belts 필요)</div>
      ) : (
        <div className={styles.layout}>
          {/* 좌: 벨트 목록(벨트 간 생애주기 비교) */}
          <aside className={styles.listPanel} aria-label="벨트 목록">
            {belts.map((belt) => (
              <BeltCard
                key={belt.slug}
                belt={belt}
                active={belt.slug === selectedSlug}
                onSelect={setSelectedSlug}
              />
            ))}
            <div className={styles.addBeltCard}>+ 추가</div>
          </aside>

          {/* 우: 선택 벨트 상세 */}
          <section className={styles.detail}>
            {momentumQuery.isLoading || !momentum ? (
              <PageLoader fullScreen={false} />
            ) : (
              <>
                <div className={styles.mapWrap}>
                  <Suspense fallback={<PageLoader fullScreen={false} />}>
                    <BeltMap
                      members={momentum.members}
                      geojson={beltGeojson}
                      onSelectMember={goToDistrict}
                    />
                  </Suspense>
                  <p className={styles.mapLegend}>
                    <span className={styles.legendDotUp} /> 성장&nbsp;&nbsp;
                    <span className={styles.legendDotDown} /> 침체&nbsp;&nbsp;
                    <span className={styles.legendDotFlat} /> 정체
                  </p>
                </div>

                <div className={styles.rankGrid}>
                  <MemberList title="뜨는 곳" members={momentum.rising} onSelect={goToDistrict} />
                  <MemberList title="지는 곳" members={momentum.falling} onSelect={goToDistrict} />
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
