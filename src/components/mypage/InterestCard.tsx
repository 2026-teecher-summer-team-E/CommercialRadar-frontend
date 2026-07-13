import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { InterestDistrict } from "../../types";
import { initialOf, seriesColor, seriesBg } from "./format";
import styles from "./mypage.module.css";

interface InterestCardProps {
  item: InterestDistrict;
  index: number;
  /** 메모 저장 콜백. 빈 메모는 null 로 전달. */
  onSaveMemo: (id: number, memo: string | null) => void;
  busy: boolean;
}

const MEMO_MAX = 500;

/** 관심 상권 1건 카드. 카드 클릭 시 랭킹처럼 상권 대시보드로 이동. 메모 추가/수정 가능. */
export default function InterestCard({
  item,
  index,
  onSaveMemo,
  busy,
}: InterestCardProps) {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.memo ?? "");

  const title = item.district_name ?? `상권 #${item.commercial_district_id}`;
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
      <span
        className={styles.cardMark}
        style={{ color: seriesColor(index), background: seriesBg(index) }}
        aria-hidden="true"
      >
        {initialOf(title)}
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
              placeholder="메모를 입력하세요"
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
        </div>
      )}
    </li>
  );
}
