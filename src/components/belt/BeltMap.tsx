import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import * as polygonClipping from "polygon-clipping";
import type { MultiPolygon as PcMultiPolygon, Polygon as PcPolygon } from "polygon-clipping";
import type { BeltMember } from "../../types";
import { fmtGrowth, fmtSales, growthColor } from "./beltFormat";
import styles from "./BeltMap.module.css";

interface BeltMapProps {
  /** 벨트 전체 멤버(성장률 내림차순). growth_pct 로 경계면을 색칠. */
  members: BeltMember[];
  /** 벨트 멤버가 속한 자치구들의 상권 경계 GeoJSON(합본). null이면 로딩 중. */
  geojson: GeoJSON.FeatureCollection | null;
  /** 폴리곤 클릭 시 상세 분석으로 이동시키기 위한 콜백(선택). */
  onSelectMember?: (districtId: number) => void;
}

const SEOUL_CENTER: L.LatLngExpression = [37.5665, 126.978];

/** 멤버 폴리곤들을 하나로 합쳐(dissolve) 벨트 전체를 감싸는 외곽선 좌표를 만든다. */
function mergeOutline(features: GeoJSON.Feature[]): GeoJSON.MultiPolygon | null {
  const geoms: Array<PcPolygon | PcMultiPolygon> = [];
  for (const f of features) {
    const g = f.geometry;
    if (g.type === "Polygon") geoms.push(g.coordinates as unknown as PcPolygon);
    else if (g.type === "MultiPolygon") geoms.push(g.coordinates as unknown as PcMultiPolygon);
  }
  if (geoms.length === 0) return null;
  try {
    const merged = polygonClipping.union(geoms[0], ...geoms.slice(1));
    return { type: "MultiPolygon", coordinates: merged as unknown as GeoJSON.Position[][][] };
  } catch {
    return null;
  }
}

/**
 * 벨트 멤버 상권의 실제 경계 폴리곤을 growth_pct 로 채색하는 코로플레스 지도.
 * 개별 상권엔 테두리를 두지 않고, 벨트 멤버 전체를 하나의 외곽선으로 감싼다.
 */
export default function BeltMap({ members, geojson, onSelectMember }: BeltMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const rendererRef = useRef<L.Canvas | null>(null);
  const fillLayerRef = useRef<L.GeoJSON | null>(null);
  const outlineLayerRef = useRef<L.GeoJSON | null>(null);
  const onSelectRef = useRef(onSelectMember);
  onSelectRef.current = onSelectMember;

  // district_id → 멤버. 폴리곤 색칠/툴팁에 사용.
  const memberById = useMemo(() => {
    const map = new Map<number, BeltMember>();
    members.forEach((m) => map.set(m.district_id, m));
    return map;
  }, [members]);

  // 1) 지도 1회 생성
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: SEOUL_CENTER,
      zoom: 12,
      preferCanvas: true,
      zoomControl: false,
    });
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    rendererRef.current = L.canvas({ padding: 0.5 });
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 0);

    const resizeObserver = new ResizeObserver(() => map.invalidateSize());
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // 2) 멤버 경계 채색 + 벨트 전체 외곽선(members/geojson 변경 시 다시 그림)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    fillLayerRef.current?.remove();
    outlineLayerRef.current?.remove();
    fillLayerRef.current = null;
    outlineLayerRef.current = null;
    if (!geojson) return;

    // 벨트 멤버에 해당하는 구역만 남긴다.
    const memberFeatures = geojson.features.filter((f) => {
      const id = f.properties?.id as number | undefined;
      return id != null && memberById.has(id);
    });
    if (memberFeatures.length === 0) return;

    // 채색 레이어: 개별 상권 면을 growth_pct 로 채우되 내부 테두리는 두지 않는다.
    const fillLayer = L.geoJSON(
      { type: "FeatureCollection", features: memberFeatures } as GeoJSON.FeatureCollection,
      {
        style: (feature) => {
          const m = memberById.get(feature?.properties?.id as number);
          return {
            renderer: rendererRef.current ?? undefined,
            stroke: false,
            fillColor: growthColor(m?.growth_pct ?? null),
            fillOpacity: 0.72,
          };
        },
        onEachFeature: (feature, lyr) => {
          const m = memberById.get(feature.properties?.id as number);
          if (!m) return;
          const rankLabel = m.rank != null ? `벨트 내 ${m.rank}위 · ` : "";
          lyr.bindTooltip(
            `<strong>${m.district_name}</strong>${m.is_anchor ? " (중심)" : ""}<br/>${rankLabel}성장 ${fmtGrowth(
              m.growth_pct,
            )}<br/>최신매출 ${fmtSales(m.sales_latest)}`,
            { sticky: true },
          );
          lyr.on("click", () => onSelectRef.current?.(m.district_id));
          lyr.on("mouseover", () => (lyr as L.Path).setStyle({ fillOpacity: 0.92 }));
          lyr.on("mouseout", () => (lyr as L.Path).setStyle({ fillOpacity: 0.72 }));
        },
      },
    );
    fillLayer.addTo(map);
    fillLayerRef.current = fillLayer;

    // 외곽선 레이어: 멤버 폴리곤을 합쳐 벨트 전체를 감싸는 단일 경계선(클릭 방해 안 하도록 비활성).
    const outlineGeom = mergeOutline(memberFeatures);
    if (outlineGeom) {
      const outlineLayer = L.geoJSON(
        { type: "Feature", properties: {}, geometry: outlineGeom } as GeoJSON.Feature,
        {
          interactive: false,
          style: {
            renderer: rendererRef.current ?? undefined,
            color: "#2b6cb0",
            weight: 2.6,
            opacity: 0.95,
            fill: false,
          },
        },
      );
      outlineLayer.addTo(map);
      outlineLayerRef.current = outlineLayer;
    }

    const bounds = fillLayer.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [geojson, memberById]);

  return <div ref={containerRef} className={styles.map} aria-label="벨트 멤버 지도" />;
}
