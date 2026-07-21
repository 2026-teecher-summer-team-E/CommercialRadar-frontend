import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { InterestDistrict } from "../../types";
import FavoriteStar from "../common/FavoriteStar";
import { DistrictTypeIcon, districtTypeLabel, districtTypeStyle } from "./districtIcons";
import styles from "./mypage.module.css";

interface InterestCardProps {
  item: InterestDistrict;
  /** 랭킹에서 보강한 상권 정보(유형·이름). 로딩 전/미포함이면 undefined. */
  info?: { name: string | null; type: string | null; district_score: number | null; survival_rate: number | null; avg_population: number | null };
  /** 메모 저장 콜백. 빈 메모는 null 로 전달. */
  onSaveMemo: (id: number, memo: string | null) => void;
  /** 즐겨찾기(관심 상권) 해제 콜백. */
  onRemove: (id: number) => void;
  busy: boolean;
  /** 리포트로 저장할 상권 선택 여부. */
  selected: boolean;
  onToggleSelect: (id: number) => void;
}

const MEMO_MAX = 500;

/** 관심 상권 1건 카드. 카드 클릭 시 랭킹처럼 상권 대시보드로 이동. 메모 추가/수정 가능. */
export default function InterestCard({
  item,
  info,
  onSaveMemo,
  onRemove,
  busy,
  selected,
  onToggleSelect,
}: InterestCardProps) {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.memo ?? "");

  const districtType = info?.type ?? null;
  const title = item.district_name ?? info?.name ?? `상권 #${item.commercial_district_id}`;
  const typeStyle = districtTypeStyle(districtType);
  const goDashboard = () => navigate(`/dashboard/${item.commercial_district_id}`);

  const startEdit = () => {
    setDraft(item.memo ?? "");
    setEditing(true);
  };
  const cancelEdit = () => {
    setDraft(item.memo ?? "");
    setEditing(false);
  };
  const save = () => {
    const trimmed = draft.trim();
    onSaveMemo(item.id, trimmed === "" ? null : trimmed);
    setEditing(false);
  };

  return (
    <li
      className={`${styles.card} ${styles.cardClickable}`}
      onClick={editing ? undefined : goDashboard}
      role="link"
      tabIndex={editing ? -1 : 0}
      onKeyDown={(e) => {
        if (editing) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          goDashboard();
        }
      }}
    >
      {/* 리포트로 저장할 상권 선택 체크박스. 카드 클릭(이동)으로 전파되지 않게 차단. */}
      <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          className={styles.selectCheckbox}
          checked={selected}
          disabled={busy}
          aria-label={`${item.district_name ?? "상권"} 선택`}
          onChange={() => onToggleSelect(item.id)}
        />
      </span>
      <span
        className={styles.cardMark}
        style={{ color: typeStyle.color, background: typeStyle.bg }}
        title={districtTypeLabel(districtType)}
        aria-hidden="true"
      >
        <DistrictTypeIcon type={districtType} size={32} />
      </span>

      <div className={styles.cardBody}>
        <p className={styles.cardTitle}>{title}</p>

        {editing ? (
          // 편집 영역: 카드 클릭(이동)·키다운이 새어나가지 않게 전파 차단.
          <div
            className={styles.memoEdit}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <textarea
              className={styles.memoInput}
              value={draft}
              maxLength={MEMO_MAX}
              placeholder="임대료, 방문 소감 등 기억할 것"
              rows={2}
              autoFocus
              disabled={busy}
              onChange={(e) => setDraft(e.target.value)}
            />
            <div className={styles.memoEditActions}>
              <span className={styles.memoCount}>
                {draft.length}/{MEMO_MAX}
              </span>
              <button
                type="button"
                className={styles.linkBtn}
                onClick={cancelEdit}
                disabled={busy}
              >
                취소
              </button>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={save}
                disabled={busy}
              >
                저장
              </button>
            </div>
          </div>
        ) : (
          // 제목 바로 아래(기존 '-' 자리)에 메모 표시. 메모 없으면 '-'.
          <div className={styles.cardMeta}>
            {item.category_name && (
              <span className={styles.chip}>{item.category_name}</span>
            )}
            <span className={styles.metaMemo}>{item.memo ?? "-"}</span>
          </div>
        )}
      </div>

      {!editing && (
        <div className={styles.cardActions}>
          <button
            type="button"
            className={styles.linkBtn}
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation();
              startEdit();
            }}
          >
            {item.memo ? "메모 수정" : "메모 추가"}
          </button>
          {/* 채워진 별을 다시 누르면 즐겨찾기 해제. 카드 클릭(이동)으로 전파되지 않게 차단. */}
          <span
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <FavoriteStar active disabled={busy} onToggle={() => onRemove(item.id)} />
          </span>
        </div>
      )}
    </li>
  );
}
