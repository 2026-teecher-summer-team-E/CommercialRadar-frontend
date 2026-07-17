import { useMemo, useState } from "react";
import { useAffordableDistricts } from "../../hooks/queries";
import type { AffordableDistrict } from "../../types";
import FilterDropdown from "../common/FilterDropdown";
import InfoTip from "../common/InfoTip";
import PageLoader from "../common/PageLoader";
import { fmtWonShort, scoreColor, sqmToPyeong } from "./simulatorFormat";
import styles from "./AffordableFinder.module.css";

interface Props {
  /** 리스트에서 상권을 고르면 시뮬레이션으로 넘길 콜백. */
  onPick: (d: { id: number; name: string }) => void;
}

const FLOOR_TYPES = ["소규모", "중대형", "집합"];
const BUDGET_PRESETS = [2_000_000, 3_000_000, 5_000_000];
type SortKey = "rent" | "score";

export default function AffordableFinder({ onPick }: Props) {
  // 입력값(폼) — "찾기" 눌러야 조회에 반영(타이핑마다 요청 방지).
  const [budgetInput, setBudgetInput] = useState("3000000");
  const [areaInput, setAreaInput] = useState("33");
  const [floorType, setFloorType] = useState("소규모");
  const [applied, setApplied] = useState<{ budget: number; area: number; floor: string } | null>({
    budget: 3_000_000,
    area: 33,
    floor: "소규모",
  });
  const [sort, setSort] = useState<SortKey>("rent");

  const query = useAffordableDistricts(
    {
      monthly_budget: applied?.budget ?? 0,
      area_sqm: applied?.area ?? 33,
      floor_type: applied?.floor ?? "소규모",
      limit: 40,
    },
    applied != null,
  );

  const districts = useMemo(() => {
    const list = query.data?.districts ?? [];
    if (sort === "score") {
      return [...list].sort((a, b) => (b.district_score ?? -1) - (a.district_score ?? -1));
    }
    return list; // 서버가 이미 임대료 오름차순
  }, [query.data, sort]);

  const apply = () => {
    const budget = Math.round(Number(budgetInput.replace(/[^0-9]/g, "")));
    const area = Number(areaInput);
    if (!budget || budget <= 0 || !area || area <= 0) return;
    setApplied({ budget, area, floor: floorType });
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.form}>
        <div className={styles.field}>
          <span className={styles.label}>월 임대료 예산</span>
          <div className={styles.budgetInputWrap}>
            <input
              className={styles.input}
              inputMode="numeric"
              value={budgetInput ? Number(budgetInput).toLocaleString() : ""}
              onChange={(e) => setBudgetInput(e.target.value.replace(/[^0-9]/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && apply()}
              aria-label="월 임대료 예산(원)"
            />
            <span className={styles.unit}>원</span>
          </div>
          <div className={styles.presets}>
            {BUDGET_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                className={styles.preset}
                onClick={() => setBudgetInput(String(p))}
              >
                {p / 1e4}만
              </button>
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <span className={styles.label}>점포 면적</span>
          <div className={styles.budgetInputWrap}>
            <input
              className={`${styles.input} ${styles.inputSm}`}
              inputMode="decimal"
              value={areaInput}
              onChange={(e) => setAreaInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && apply()}
              aria-label="점포 면적(㎡)"
            />
            <span className={styles.unit}>㎡</span>
          </div>
          <span className={styles.hint}>약 {sqmToPyeong(Number(areaInput) || 0)}평</span>
        </div>

        <div className={styles.field}>
          <span className={styles.label}>
            상가유형{" "}
            <InfoTip label="상가유형 설명" align="right">
              <strong>건물 규모·소유 형태 분류</strong> (한국부동산원 임대료 기준)
              <br />• <b>소규모</b>: 2층 이하·연면적 330㎡ 이하 소형 상가 (골목 1~2층)
              <br />• <b>중대형</b>: 3층 이상 또는 330㎡ 초과 (대로변 빌딩)
              <br />• <b>집합</b>: 구분소유 분양상가 (몰·주상복합)
              <br />유형에 따라 ㎡단가와 대상 상권이 달라집니다.
            </InfoTip>
          </span>
          <div className={styles.dropdownCell}>
            <FilterDropdown
              label="상가유형"
              value={floorType}
              options={FLOOR_TYPES}
              onChange={setFloorType}
              ariaLabel="상가유형 선택"
            />
          </div>
        </div>

        <div className={styles.field}>
          <span className={styles.label} aria-hidden>
            &nbsp;
          </span>
          <button type="button" className={styles.findBtn} onClick={apply}>
            찾기
          </button>
        </div>
      </div>

      {/* 결과 */}
      {query.isLoading ? (
        <PageLoader fullScreen={false} />
      ) : query.isError ? (
        <div className={styles.empty}>목록을 불러오지 못했습니다.</div>
      ) : !query.data ? (
        <div className={styles.empty}>예산을 입력하고 찾기를 눌러보세요.</div>
      ) : districts.length === 0 ? (
        <div className={styles.empty}>이 예산으로 창업 가능한 상권이 없어요. 예산을 올려보세요.</div>
      ) : (
        <>
          <div className={styles.resultHead}>
            <span className={styles.resultCount}>
              예산 이하 <strong>{query.data.count.toLocaleString()}곳</strong>
              {query.data.count > districts.length && ` · 상위 ${districts.length}곳`}
            </span>
            <div className={styles.sortToggle}>
              <button
                type="button"
                className={sort === "rent" ? styles.sortActive : styles.sortBtn}
                onClick={() => setSort("rent")}
              >
                저렴한 순
              </button>
              <button
                type="button"
                className={sort === "score" ? styles.sortActive : styles.sortBtn}
                onClick={() => setSort("score")}
              >
                점수 높은 순
              </button>
            </div>
          </div>
          <ul className={styles.list}>
            {districts.map((d: AffordableDistrict, i) => (
              <li key={d.district_id}>
                <button type="button" className={styles.row} onClick={() => onPick({ id: d.district_id, name: d.district_name })}>
                  <span className={styles.rank}>{i + 1}</span>
                  <span className={styles.rowMain}>
                    <span className={styles.name}>{d.district_name}</span>
                    <span className={styles.meta}>{[d.gu_name, d.type_name].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className={styles.rowRight}>
                    <span className={styles.rent}>{fmtWonShort(d.est_monthly_rent)}/월</span>
                    <span className={styles.rentSub}>{d.rent_per_sqm.toLocaleString()}천원/㎡</span>
                  </span>
                  {d.district_score != null && (
                    <span className={styles.scoreBadge} style={{ background: scoreColor(d.district_score) }}>
                      {Math.round(d.district_score)}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <p className={styles.footnote}>
            추정 월 임대료 = ㎡당 임대료 × 면적. 임대료 데이터가 있는 상권(~14%)만 대상입니다. 상권을 누르면 상세 분석으로 이동합니다.
          </p>
        </>
      )}
    </div>
  );
}
