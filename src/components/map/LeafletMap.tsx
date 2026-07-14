import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { DistrictGeo } from "../../types";
import { scoreColor } from "./mapData";
import styles from "./LeafletMap.module.css";

interface LeafletMapProps {
  points: DistrictGeo[];
  geojson: GeoJSON.FeatureCollection | null;
  selectedId: number;
  guFilter: string;
  activeName: string | null;
  activeType: string | null;
  activeScore: number | null;
  onSelect: (id: number) => void;
  onOpenProfile: (id: number) => void;
}

const SEOUL_CENTER: L.LatLngExpression = [37.5665, 126.978];

export default function LeafletMap({
  points,
  geojson,
  selectedId,
  guFilter,
  activeName,
  activeType,
  activeScore,
  onSelect,
  onOpenProfile,
}: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const rendererRef = useRef<L.Canvas | null>(null);

  const geoLayerRef = useRef<L.GeoJSON | null>(null);
  const polysRef = useRef<Map<number, L.Path>>(new Map());

  const onSelectRef = useRef(onSelect);
  const onOpenRef = useRef(onOpenProfile);
  onSelectRef.current = onSelect;
  onOpenRef.current = onOpenProfile;

  // 방금 이 selectedId로 카메라 이동을 이미 했는지 추적.
  // geojson이 뒤늦게 로드돼 selectedId의 구역이 나중에야 생기는 경우를 다시 시도하기 위해
  // effect 3의 의존성에 geojson도 포함하는데, 그 재실행이 데이터 갱신처럼 선택과 무관한 이유일 때는
  // 카메라를 또 움직이지 않도록 이 ref로 "이미 이동했음"을 구분한다.
  const flownRef = useRef<number | null>(null);

  // 선택 상권 팝업 DOM(이름/유형/점수 + 프로필 버튼).
  const buildPopup = () => {
    const el = document.createElement("div");
    const name = document.createElement("div");
    name.className = styles.popupName;
    name.textContent = activeName ?? "";
    el.appendChild(name);
    const meta = document.createElement("div");
    meta.className = styles.popupMeta;
    meta.innerHTML = `${activeType ?? ""}${
      activeScore != null ? ` · 상권점수 <span class="${styles.popupScore}">${activeScore}</span>` : ""
    }`;
    el.appendChild(meta);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = styles.popupBtn;
    btn.textContent = "상세 분석 보기";
    btn.addEventListener("click", () => onOpenRef.current(selectedId));
    el.appendChild(btn);
    return el;
  };

  // 1) 지도 1회 생성
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: SEOUL_CENTER,
      zoom: 12,
      preferCanvas: true,
      // 좌측 상단에 플로팅 패널이 얹히므로 확대/축소 컨트롤은 우측 하단에 둔다.
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

    // 사이드바 접힘/펼침 등 부모 크기 변화를 Leaflet이 스스로 감지하지 못해 지도가 잘리므로,
    // 컨테이너 크기 변화를 직접 관찰해 invalidateSize를 호출한다(트랜지션 도중에도 계속 맞춰짐).
    const resizeObserver = new ResizeObserver(() => map.invalidateSize());
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      polysRef.current.clear();
    };
  }, []);

  // 2) 구역(폴리곤) 레이어(geojson 변경 시)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !geojson) return;
    geoLayerRef.current?.remove();
    polysRef.current.clear();
    const layer = L.geoJSON(geojson, {
      style: (feature) => {
        const c = scoreColor(feature?.properties?.district_score as number | null);
        return {
          renderer: rendererRef.current ?? undefined,
          color: c,
          weight: 1,
          opacity: 0.65,
          fillColor: c,
          fillOpacity: 0.22,
        };
      },
      onEachFeature: (feature, lyr) => {
        const id = feature.properties?.id as number;
        polysRef.current.set(id, lyr as L.Path);
        lyr.on("click", () => onSelectRef.current(id));
        lyr.bindTooltip(feature.properties?.district_name ?? "", { sticky: true });
      },
    });
    geoLayerRef.current = layer;
    layer.addTo(map);
  }, [geojson]); // eslint-disable-line react-hooks/exhaustive-deps

  // 3) 선택 강조 + 이동 + 팝업
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const isNewSelection = flownRef.current !== selectedId;

    polysRef.current.forEach((lyr, id) => {
      const sel = id === selectedId;
      const c = scoreColor(
        (lyr as L.Path & { feature?: GeoJSON.Feature }).feature?.properties?.district_score as number | null,
      );
      lyr.setStyle({ weight: sel ? 2.5 : 1, opacity: sel ? 1 : 0.6, fillColor: c, fillOpacity: sel ? 0.5 : 0.2, color: c });
      if (sel) lyr.bringToFront();
    });
    const sel = polysRef.current.get(selectedId) as L.Polygon | undefined;
    if (sel && typeof sel.getBounds === "function") {
      const wasOpen = sel.isPopupOpen();
      if (isNewSelection) {
        flownRef.current = selectedId;
        map.flyToBounds(sel.getBounds(), { padding: [80, 80], maxZoom: 17, duration: 0.8 });
      }
      sel.bindPopup(buildPopup(), { closeButton: true, minWidth: 170 });
      if (isNewSelection || wasOpen) sel.openPopup();
    }
    // geojson도 의존성에 포함: 데이터가 늦게 도착해 selectedId의 구역이 뒤늦게 생기는 경우를 다시 시도한다.
  }, [selectedId, activeName, activeType, activeScore, geojson]); // eslint-disable-line react-hooks/exhaustive-deps

  // 4) 자치구 필터 변경 시 해당 자치구 범위로 카메라 이동
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (guFilter === "전체") {
      map.flyTo(SEOUL_CENTER, 12, { duration: 0.8 });
      return;
    }
    if (points.length === 0) return;
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    map.flyToBounds(bounds, { padding: [64, 64], maxZoom: 16, duration: 0.8 });
  }, [guFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} className={styles.map} aria-label="상권 지도" />;
}
