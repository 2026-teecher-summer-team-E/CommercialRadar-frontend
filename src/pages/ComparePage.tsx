import { useEffect, useMemo, useState } from "react";
import { apiClient } from "../lib/apiClient";
import { commercialApi } from "../services/commercialApi";
import type { DistrictSearchResult } from "../components/map/mapData";
import type {
  DistrictCompareResponse,
  RadarResponse,
  DistrictTimeSeriesResponse,
  CategoryRankingResponse,
} from "../types";
import RadarChartSvg from "../components/compare/RadarChartSvg";
import type { RadarSeries } from "../components/compare/RadarChartSvg";
import LineChartSvg from "../components/compare/LineChartSvg";
import type { LineSeries } from "../components/compare/LineChartSvg";
import Legend from "../components/compare/Legend";
import ExpandModal from "../components/compare/ExpandModal";
import {
  seriesColor,
  fmtNum,
  fmtPct,
  fmtPopulation,
  closureRiskLabel,
} from "../components/compare/format";
import styles from "./ComparePage.module.css";

type ModalKind = "radar" | "trend" | null;

interface CompareData {
  compare: DistrictCompareResponse;
  radars: RadarResponse[];
  timeSeries: DistrictTimeSeriesResponse[];
  ranking: CategoryRankingResponse | null;
}

const EXPAND_ICON = "⤢";

function commonValues(groups: string[][]): string[] {
  if (groups.length === 0) return [];
  const [first, ...rest] = groups;
  return Array.from(new Set(first)).filter((value) => rest.every((group) => group.includes(value)));
}

function formatQuarter(value: string): string {
  const match = /^(\d{4})-Q([1-4])$/.exec(value);
  return match ? `${match[1]}년 ${match[2]}분기` : value;
}

export default function ComparePage() {
  const [selectedIds, setSelectedIds] = useState<number[]>([1, 2, 3]);
  const [data, setData] = useState<CompareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [modal, setModal] = useState<ModalKind>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DistrictSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [selectionMessage, setSelectionMessage] = useState<string | null>(null);
  const [selectedQuarter, setSelectedQuarter] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [quarterOptions, setQuarterOptions] = useState<string[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [quarterOptionsLoading, setQuarterOptionsLoading] = useState(true);
  const [categoryOptionsLoading, setCategoryOptionsLoading] = useState(true);
  const [filterOptionsError, setFilterOptionsError] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(false);

    const snapshotParams = {
      year_quarter: selectedQuarter || undefined,
      category_name: selectedCategory || undefined,
    };

    Promise.all([
      commercialApi.compare(selectedIds, snapshotParams),
      Promise.all(selectedIds.map((id) => commercialApi.radar(id, snapshotParams))),
      Promise.all(
        selectedIds.map((id) =>
          commercialApi.timeSeries(id, {
            metrics: "survival_rate",
            category_name: selectedCategory || undefined,
          }),
        ),
      ),
      selectedIds.length > 0
        ? commercialApi.categoryRanking(
            selectedIds[0],
            selectedQuarter ? { year_quarter: selectedQuarter } : undefined,
          )
        : Promise.resolve(null),
    ])
      .then(([compareRes, radarRes, tsRes, rankingRes]) => {
        if (!alive) return;
        setData({
          compare: compareRes.data,
          radars: radarRes.map((r) => r.data),
          timeSeries: tsRes.map((r) => r.data),
          ranking: rankingRes ? rankingRes.data : null,
        });
      })
      .catch(() => {
        if (alive) setError(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [selectedIds, selectedQuarter, selectedCategory]);

  useEffect(() => {
    let alive = true;
    setQuarterOptionsLoading(true);
    setFilterOptionsError(false);

    Promise.all(
      selectedIds.map((id) => commercialApi.timeSeries(id, { metrics: "survival_rate" })),
    )
      .then((responses) => {
        if (!alive) return;
        const common = commonValues(
          responses.map((response) => response.data.data.map((point) => point.year_quarter)),
        ).sort((a, b) => b.localeCompare(a));
        setQuarterOptions(common);
        setSelectedQuarter((current) => (current && !common.includes(current) ? "" : current));
      })
      .catch(() => {
        if (!alive) return;
        setQuarterOptions([]);
        setFilterOptionsError(true);
      })
      .finally(() => {
        if (alive) setQuarterOptionsLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [selectedIds]);

  useEffect(() => {
    const targetQuarter = selectedQuarter || data?.compare.year_quarter || "";
    if (!targetQuarter) {
      setCategoryOptions([]);
      setCategoryOptionsLoading(false);
      return;
    }

    let alive = true;
    setCategoryOptionsLoading(true);
    setFilterOptionsError(false);

    Promise.all(
      selectedIds.map((id) => commercialApi.categoryStats(id, { year_quarter: targetQuarter })),
    )
      .then((responses) => {
        if (!alive) return;
        const common = commonValues(
          responses.map((response) => response.data.categories.map((category) => category.category_name)),
        ).sort((a, b) => a.localeCompare(b, "ko"));
        setCategoryOptions(common);
        setSelectedCategory((current) => (current && !common.includes(current) ? "" : current));
      })
      .catch(() => {
        if (!alive) return;
        setCategoryOptions([]);
        setFilterOptionsError(true);
      })
      .finally(() => {
        if (alive) setCategoryOptionsLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [selectedIds, selectedQuarter, data?.compare.year_quarter]);

  // 추가 패널 검색: 지도 페이지와 동일한 상권 검색 API를 사용한다.
  useEffect(() => {
    if (!addOpen) return;
    const keyword = searchQuery.trim();
    if (!keyword) {
      setSearchResults([]);
      setSearchLoading(false);
      setSearchError(false);
      return;
    }

    let alive = true;
    setSearchLoading(true);
    setSearchError(false);
    const timer = window.setTimeout(() => {
      apiClient
        .get<DistrictSearchResult[]>("/api/commercial-districts/search", { params: { q: keyword } })
        .then((response) => {
          if (alive) setSearchResults(response.data);
        })
        .catch(() => {
          if (alive) {
            setSearchResults([]);
            setSearchError(true);
          }
        })
        .finally(() => {
          if (alive) setSearchLoading(false);
        });
    }, 250);

    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [addOpen, searchQuery]);

  const openAddPanel = () => {
    if (selectedIds.length >= 5) {
      setSelectionMessage("상권은 최대 5개까지 비교할 수 있어요.");
      return;
    }
    setSelectionMessage(null);
    setAddOpen(true);
  };

  const closeAddPanel = () => {
    setAddOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    setSearchError(false);
  };

  const addDistrict = (district: DistrictSearchResult) => {
    if (selectedIds.includes(district.id)) {
      setSelectionMessage("이미 비교 중인 상권이에요.");
      return;
    }
    if (selectedIds.length >= 5) {
      setSelectionMessage("상권은 최대 5개까지 비교할 수 있어요.");
      closeAddPanel();
      return;
    }
    setSelectedIds((current) => [...current, district.id]);
    setSelectionMessage(null);
    closeAddPanel();
  };

  const removeDistrict = (id: number) => {
    if (selectedIds.length <= 2) {
      setSelectionMessage("비교하려면 상권을 최소 2개 유지해야 해요. 다른 상권을 먼저 추가해주세요.");
      return;
    }
    setSelectedIds((current) => current.filter((districtId) => districtId !== id));
    setSelectionMessage(null);
  };

  const districts = data?.compare.districts ?? [];
  const names = districts.map((d) => d.district_name);

  // 레이더: 모든 상권의 축 라벨은 동일하다고 가정, 첫 상권 축을 기준으로 사용.
  const radarAxes = useMemo(() => data?.radars[0]?.axes.map((a) => a.label) ?? [], [data]);
  const radarSeries: RadarSeries[] = useMemo(() => {
    if (!data) return [];
    return data.radars.map((r, i) => ({
      name: names[i] ?? `상권 ${i + 1}`,
      values: r.axes.map((a) => a.value),
    }));
  }, [data, names]);

  // 라인: 모든 상권 분기의 합집합을 정렬해 X축으로 사용.
  const trendLabels = useMemo(() => {
    if (!data) return [];
    const set = new Set<string>();
    data.timeSeries.forEach((ts) => ts.data.forEach((q) => set.add(q.year_quarter)));
    return Array.from(set).sort();
  }, [data]);

  const trendSeries: LineSeries[] = useMemo(() => {
    if (!data) return [];
    return data.timeSeries.map((ts, i) => {
      const byQuarter = new Map(ts.data.map((q) => [q.year_quarter, q.survival_rate]));
      return {
        name: names[i] ?? `상권 ${i + 1}`,
        points: trendLabels.map((label) => byQuarter.get(label) ?? null),
      };
    });
  }, [data, names, trendLabels]);

  if (loading) {
    return (
      <div className={styles.page}>
        <Header />
        <div className={styles.skeletonWrap}>
          <div className={styles.skeleton} />
          <div className={styles.skeleton} />
          <div className={styles.skeleton} />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={styles.page}>
        <Header />
        <div className={styles.empty}>비교 데이터를 받아오지 못했습니다. 페이지를 새로고침해보세요.</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Header />

      {/* 컨트롤 바 */}
      <div className={styles.controlBar}>
        <div className={styles.selectionArea}>
          <div className={styles.chips}>
            {districts.map((d, i) => (
              <span key={d.id} className={styles.chip}>
                <span className={styles.chipDot} style={{ background: seriesColor(i) }} />
                {d.district_name}
                <button
                  type="button"
                  className={styles.chipClose}
                  aria-label={`${d.district_name} 제거`}
                  onClick={() => removeDistrict(d.id)}
                >
                  ×
                </button>
              </span>
            ))}
            <button
              type="button"
              className={styles.addC<div className={styles.selectionArea}>
          <div className={styles.chips}>
            {districts.map((d, i) => (
              <span key={d.id} className={styles.chip}>
                <span className={styles.chipDot} style={{ background: seriesColor(i) }} />
                {d.district_name}
                <button
                  type="button"
                  className={styles.chipClose}
                  aria-label={`${d.district_name} 제거`}
                  onClick={() => removeDistrict(d.id)}
                >
                  ×
                </button>
              </span>
            ))}
           <button
              type="button"
              className={styles.addChip}
              onClick={openAddPanel}
              aria-expanded={addOpen}
            >
              {selectedIds.length >= 5 ? "최대 5개" : "+ 상권 추가"}
            </button>
            
              <input
                className={styles.searchInput}
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="예: 강남역, 마포구, 성수동"
                autoFocus
              />
              <div className={styles.searchResults} aria-live="polite">
                {!searchQuery.trim() && <p className={styles.searchStatus}>검색어를 입력해주세요.</p>}
                {searchQuery.trim() && searchLoading && <p className={styles.searchStatus}>검색 중…</p>}
                {searchQuery.trim() && !searchLoading && searchError && (
                  <p className={styles.searchStatus}>검색 결과를 불러오지 못했어요.</p>
                )}
                {searchQuery.trim() &&
                  !searchLoading &&
                  !searchError &&
                  searchResults.filter((item) => !selectedIds.includes(item.id)).length === 0 && (
                    <p className={styles.searchStatus}>추가할 수 있는 검색 결과가 없어요.</p>
                  )}
                {!searchLoading &&
                  !searchError &&
                  searchResults
                    .filter((item) => !selectedIds.includes(item.id))
                    .map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={styles.searchResult}
                        onClick={() => addDistrict(item)}
                      >
                        <span className={styles.resultName}>{item.district_name}</span>
                        <span className={styles.resultMeta}>
                          {[item.gu_name, item.dong_name, item.type_name].filter(Boolean).join(" · ")}
                        </span>
                      </button>
                    ))}
              </div>
            </div>
          )}
        </div>
        <div className={styles.selectors}>
          <label className={styles.selectorLabel}>
            <span>기준 분기</span>
            <select
              className={styles.selector}
              value={selectedQuarter}
              onChange={(event) => {
                setSelectedQuarter(event.target.value);
                setSelectedCategory("");
              }}
              disabled={quarterOptionsLoading}
              aria-label="비교 기준 분기"
            >
              <option value="">
                {data.compare.year_quarter
                  ? `최신 공통 · ${formatQuarter(data.compare.year_quarter)}`
                  : "최신 공통 분기"}
              </option>
              {quarterOptions.map((quarter) => (
                <option key={quarter} value={quarter}>
                  {formatQuarter(quarter)}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.selectorLabel}>
            <span>비교 업종</span>
            <select
              className={styles.selector}
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
              disabled={categoryOptionsLoading || categoryOptions.length === 0}
              aria-label="비교 업종"
            >
              <option value="">전체 업종</option>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          {filterOptionsError && <span className={styles.filterError}>선택 목록을 불러오지 못했어요.</span>}
        </div>
      </div>

      {/* 핵심 지표 비교표 */}
      <section className={styles.section}>
        <SectionTitle
          title="핵심 지표 비교"
          subtitle={`${selectedCategory || "전체 업종"} · ${formatQuarter(data.compare.year_quarter || selectedQuarter || "-")}`}
        />
        <div className={styles.card}>
          <MetricsTable districts={districts} />
        </div>
      </section>

      {/* 차트 2열 */}
      <section className={styles.chartsGrid}>
        <div className={styles.card}>
          <ChartHeader title="지표 레이더" onExpand={() => setModal("radar")} />
          {radarSeries.length > 0 && radarAxes.length >= 3 ? (
            <div className={styles.chartBody}>
              <RadarChartSvg axes={radarAxes} series={radarSeries} />
            </div>
          ) : (
            <div className={styles.empty}>레이더 차트를 그릴 데이터가 부족합니다.</div>
          )}
          <Legend names={names} />
        </div>

        <div className={styles.card}>
          <div style={{ marginBottom: 12 }}>
            <SectionTitle
              title="업종별 추천 순위"
              subtitle={
                districts[0] ? `${districts[0].district_name} 기준 상위 업종` : "선택 상권 기준 상위 업종"
              }
              showAccent={false}
            />
          </div>
          <RankingTable ranking={data.ranking} />
        </div>
      </section>

      {/* 분기별 생존율 추이: 그래프가 길쭉해서 2열보단 전체 폭 차지가 낫다. */}
      <section className={styles.section}>
        <div className={styles.card}>
          <ChartHeader
            title={`${selectedCategory || "전체 업종"} 분기별 생존율 추이`}
            onExpand={() => setModal("trend")}
          />         
          <div className={styles.legendTop}>
            <Legend names={names} />
          </div>
          {trendLabels.length > 0 ? (
            <div className={styles.chartBody}>
              <LineChartSvg labels={trendLabels} series={trendSeries} />
            </div>
          ) : (
            <div className={styles.empty}>생존율 추이 기록이 아직 없습니다.</div>
          )}
        </div>
      </section>

      {/* 확대 모달 */}
      {modal === "radar" && radarAxes.length >= 3 && (
        <ExpandModal
          title="지표 레이더"
          subtitle="상권별 5개 축 비교"
          onClose={() => setModal(null)}
        >
          <div className={styles.modalChart}>
            <RadarChartSvg axes={radarAxes} series={radarSeries} size={420} />
            <Legend names={names} />
          </div>
          <RadarValueTable axes={radarAxes} series={radarSeries} />
        </ExpandModal>
      )}

      {modal === "trend" && trendLabels.length > 0 && (
        <ExpandModal
          title="분기별 생존율 추이"
          subtitle="상권별 생존율(%) 추이"
          onClose={() => setModal(null)}
        >
          <div className={styles.modalChartWide}>
            <div className={styles.legendTop}>
              <Legend names={names} />
            </div>
            <LineChartSvg labels={trendLabels} series={trendSeries} width={760} height={360} />
          </div>
        </ExpandModal>
      )}
    </div>
  );
}

function Header() {
  return (
    <div className={styles.header}>
      <div>
        <h1 className={styles.title}>상권 비교</h1>
        <p className={styles.subtitle}>나란히 놓으면 보이는 것들이 있습니다</p>
      </div>
      <button type="button" className={styles.saveBtn}>
        리포트로 저장
      </button>
    </div>
  );
}

function SectionTitle({
  title,
  subtitle,
  showAccent = true,
}: {
  title: string;
  subtitle?: string;
  showAccent?: boolean;
}) {
  return (
    <div className={styles.sectionTitle}>
      {showAccent && <span className={styles.accentBar} />}
      <div>
        <h2 className={styles.sectionHeading}>{title}</h2>
        {subtitle && <p className={styles.sectionSub}>{subtitle}</p>}
      </div>
    </div>
  );
}

function ChartHeader({ title, onExpand }: { title: string; onExpand: () => void }) {
  return (
    <div className={styles.chartHeader}>
      <h3 className={styles.chartTitle}>{title}</h3>
      <button type="button" className={styles.expandBtn} onClick={onExpand} aria-label={`${title} 확대`}>
        {EXPAND_ICON}
      </button>
    </div>
  );
}

/** 핵심 지표 비교표. 지표별 최고값 셀을 하이라이트. */
function MetricsTable({ districts }: { districts: DistrictCompareResponse["districts"] }) {
  // 각 지표에서 "최고(=가장 좋음)" 인덱스 계산. 폐업위험은 낮을수록 좋음.
  const bestIndex = (
    values: Array<number | null>,
    mode: "max" | "min",
  ): number => {
    let best = -1;
    let bestVal: number | null = null;
    values.forEach((v, i) => {
      if (v == null) return;
      if (bestVal == null || (mode === "max" ? v > bestVal : v < bestVal)) {
        bestVal = v;
        best = i;
      }
    });
    return best;
  };

  const scores = districts.map((d) => d.district_score);
  const survivals = districts.map((d) => d.survival_rate);
  const closures = districts.map((d) => d.closure_rate);
  const populations = districts.map((d) => d.avg_population);

  const rows = [
    {
      label: "종합 점수",
      best: bestIndex(scores, "max"),
      cells: districts.map((d) => fmtNum(d.district_score, 1)),
    },
    {
      label: "생존율",
      best: bestIndex(survivals, "max"),
      cells: districts.map((d) => fmtPct(d.survival_rate)),
    },
    {
      label: "폐업 위험",
      best: bestIndex(closures, "min"),
      cells: districts.map((d) => closureRiskLabel(d.closure_rate)),
    },
    {
      label: "유동인구",
      best: bestIndex(populations, "max"),
      cells: districts.map((d) => fmtPopulation(d.avg_population)),
    },
  ];

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th className={styles.metricCol}>지표</th>
          {districts.map((d, i) => (
            <th key={d.id} className={styles.numCell}>
              <span className={styles.thDot} style={{ background: seriesColor(i) }} />
              {d.district_name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <td className={styles.metricCol}>{row.label}</td>
            {row.cells.map((cell, i) => (
              <td key={i} className={`${styles.numCell} ${i === row.best ? styles.bestCell : ""}`}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** 레이더 확대 모달의 축별 값 테이블. 축마다 최고값 시리즈색 강조. */
function RadarValueTable({ axes, series }: { axes: string[]; series: RadarSeries[] }) {
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th className={styles.metricCol}>축</th>
          {series.map((s, i) => (
            <th key={i} className={styles.numCell}>
              <span className={styles.thDot} style={{ background: seriesColor(i) }} />
              {s.name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {axes.map((axis, ai) => {
          const vals = series.map((s) => s.values[ai] ?? null);
          let best = -1;
          let bestVal: number | null = null;
          vals.forEach((v, i) => {
            if (v == null) return;
            if (bestVal == null || v > bestVal) {
              bestVal = v;
              best = i;
            }
          });
          return (
            <tr key={axis}>
              <td className={styles.metricCol}>{axis}</td>
              {vals.map((v, i) => (
                <td
                  key={i}
                  className={styles.numCell}
                  style={i === best ? { color: seriesColor(i), fontWeight: 700 } : undefined}
                >
                  {fmtNum(v, 0)}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** 업종별 추천 순위표. */
function RankingTable({ ranking }: { ranking: CategoryRankingResponse | null }) {
  if (!ranking || ranking.ranking.length === 0) {
    return <div className={styles.empty}>업종 순위 데이터가 없어요.</div>;
  }
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th className={styles.rankCol}>순위</th>
          <th className={styles.leftCell}>업종</th>
          <th className={styles.numCell}>생존율</th>
          <th className={styles.numCell}>점포수</th>
          <th className={styles.numCell}>점수</th>
        </tr>
      </thead>
      <tbody>
        {ranking.ranking.map((item) => (
          <tr key={`${item.rank}-${item.category_name ?? ""}`}>
            <td className={styles.rankCol}>{item.rank}</td>
            <td className={styles.leftCell}>{item.category_name ?? "-"}</td>
            <td className={styles.numCell}>{fmtPct(item.survival_rate)}</td>
            <td className={styles.numCell}>
              {item.total_business != null ? item.total_business.toLocaleString("ko-KR") : "-"}
            </td>
            <td className={styles.numCell}>{fmtNum(item.district_score, 1)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
