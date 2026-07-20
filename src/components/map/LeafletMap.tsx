import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { DistrictGeo } from "../../types";
import { scoreColor } from "./mapData";
import styles from "./LeafletMap.module.css";

/** 지도에 순위 라벨로 찍을 핑 1개. */
export interface MapPin {
  id: number;
  lat: number;
  lng: number;
  /** 핑 안에 표시할 짧은 텍스트(순위 번호 등). */
  label: string;
  /** 호버 툴팁에 보여줄 상권명. */
  name: string;
}

interface LeafletMapProps {
  points: DistrictGeo[];
  geojson: GeoJSON.FeatureCollection | null;
  selectedId: number | null;
  /** 순위 핑 마커(창업 시뮬레이터 결과 등). 값이 바뀌면 핑 전체가 보이도록 카메라를 맞춘다. */
  pins?: MapPin[];
  guFilter: string;
  activeName: string | null;
  activeType: string | null;
  activeScore: number | null;
  /** 마운트 시 selectedId로 명확한 포커스 이동 의도가 있었는지(랭킹 등에서 진입). true면 처음부터 flyToBounds+팝업, false면 카메라는 조용히 유지하되 팝업만 자동으로 연다. */
  flyToSelectionOnMount: boolean;
  onSelect: (id: number) => void;
  onOpenProfile: (id: number) => void;
}

const SEOUL_CENTER: L.LatLngExpression = [37.5665, 126.978];
const MAP_VIEW_STORAGE_KEY = "commercialRadar.mapViewState.v2";

interface PersistedMapViewState {
  center: [number, number];
  zoom: number;
}

function readMapViewState(): PersistedMapViewState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(MAP_VIEW_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedMapViewState>;
    const [lat, lng] = parsed.center ?? [];
    if (
      typeof lat !== "number" ||
      typeof lng !== "number" ||
      typeof parsed.zoom !== "number" ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      !Number.isFinite(parsed.zoom)
    ) {
      return null;
    }
    return { center: [lat, lng], zoom: parsed.zoom };
  } catch {
    return null;
  }
}

function saveMapViewState(map: L.Map) {
  const center = map.getCenter();
  saveMapViewStateValue([center.lat, center.lng], map.getZoom());
}

function saveMapViewStateValue(center: [number, number], zoom: number) {
  const state: PersistedMapViewState = {
    center,
    zoom,
  };
  window.localStorage.setItem(MAP_VIEW_STORAGE_KEY, JSON.stringify(state));
}

export default function LeafletMap({
  points,
  geojson,
  selectedId,
  pins,
  guFilter,
  activeName,
  activeType,
  activeScore,
  flyToSelectionOnMount,
  onSelect,
  onOpenProfile,
}: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const rendererRef = useRef<L.Canvas | null>(null);
  const guFilterReadyRef = useRef(false);
  const pendingProgrammaticViewRef = useRef(false);
  const programmaticMoveTimerRef = useRef<number | null>(null);

  const geoLayerRef = useRef<L.GeoJSON | null>(null);
  const polysRef = useRef<Map<number, L.Path>>(new Map());
  const pinsLayerRef = useRef<L.LayerGroup | null>(null);
  // 핀(순위 마커)을 id로 참조해 선택 시 해당 핀으로 이동·팝업할 수 있게 한다(폴리곤이 없을 때 폴백).
  const pinMarkersRef = useRef<Map<number, L.Marker>>(new Map());

  const onSelectRef = useRef(onSelect);
  const onOpenRef = useRef(onOpenProfile);
  onSelectRef.current = onSelect;
  onOpenRef.current = onOpenProfile;

  // 방금 이 selectedId로 카메라 이동을 이미 했는지 추적.
  // geojson이 뒤늦게 로드돼 selectedId의 구역이 나중에야 생기는 경우를 다시 시도하기 위해
  // effect 3의 의존성에 geojson도 포함하는데, 그 재실행이 데이터 갱신처럼 선택과 무관한 이유일 때는
  // 카메라를 또 움직이지 않도록 이 ref로 "이미 이동했음"을 구분한다.
  const flownRef = useRef<number | null>(null);
  // 마운트 후 팝업을 한 번이라도 자동으로 띄웠는지 추적(카메라 이동 여부와는 별개).
  // flownRef는 "카메라를 움직였는가"만 의미하도록 하고, 팝업 자동 오픈은 이 ref로 독립적으로 관리해서
  // "마운트 시 카메라는 조용히 유지 + 팝업은 자동으로 연다" 케이스를 표현할 수 있게 한다.
  const initialPopupShownRef = useRef(false);

  const markProgrammaticMove = (map: L.Map) => {
    pendingProgrammaticViewRef.current = true;
    if (programmaticMoveTimerRef.current != null) {
      window.clearTimeout(programmaticMoveTimerRef.current);
    }
    programmaticMoveTimerRef.current = window.setTimeout(() => {
      pendingProgrammaticViewRef.current = false;
      saveMapViewState(map);
      programmaticMoveTimerRef.current = null;
    }, 1200);
  };
  // effect 4는 마운트 시에도 한 번 실행되는데, 그때 guFilter 기본값("전체")이
  // effect 3의 flyToBounds(딥링크로 들어온 selectedId 확대) 직후 카메라를
  // 서울 전체 뷰로 되돌려버려 확대가 무효화된다. 마운트 시 첫 실행은 건너뛰고
  // 사용자가 실제로 필터를 바꿀 때만 카메라를 움직이도록 이 ref로 구분한다.
  const guFilterMountedRef = useRef(false);

  // 선택 상권 팝업 DOM(이름/유형/점수 + 프로필 버튼).
  const buildPopup = (id: number) => {
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
    btn.addEventListener("click", () => onOpenRef.current(id));
    el.appendChild(btn);
    return el;
  };

  // 1) 지도 1회 생성
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const restoredView = readMapViewState();
    const map = L.map(containerRef.current, {
      center: restoredView?.center ?? SEOUL_CENTER,
      zoom: restoredView?.zoom ?? 12,
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
    const onViewChanged = () => {
      if (pendingProgrammaticViewRef.current) return;
      if (programmaticMoveTimerRef.current != null) {
        window.clearTimeout(programmaticMoveTimerRef.current);
        programmaticMoveTimerRef.current = null;
      }
      saveMapViewState(map);
    };
    const onMoveEnded = () => {
      pendingProgrammaticViewRef.current = false;
      if (programmaticMoveTimerRef.current != null) {
        window.clearTimeout(programmaticMoveTimerRef.current);
        programmaticMoveTimerRef.current = null;
      }
      saveMapViewState(map);
    };
    map.on("zoomend", onViewChanged);
    map.on("moveend", onMoveEnded);
    // flownRef/guFilterMountedRef는 "이 map 인스턴스로 이미 카메라를 움직였는지"를
    // 추적하는 값이라 컴포넌트가 아니라 map 인스턴스 생애주기에 묶여야 한다.
    // - flyToSelectionOnMount가 false(새로고침/일반 진입): 마운트 시점 selectedId는 "이미 그
    //   위치로 이동해 있는 것"으로 간주해 flownRef를 채워둔다 → effect 3이 마운트 직후
    //   isNewSelection=false로 판단해 자동 flyToBounds를 건너뛴다(흔들림 방지).
    // - flyToSelectionOnMount가 true(랭킹 등에서 특정 상권을 향한 명확한 이동 의도로 진입):
    //   flownRef를 비워둬 effect 3이 "새 선택"으로 처리하게 해 정상적으로 flyToBounds가 실행되게 한다.
    flownRef.current = flyToSelectionOnMount ? null : selectedId;
    initialPopupShownRef.current = false;
    guFilterMountedRef.current = false;
    setTimeout(() => map.invalidateSize(), 0);

    // 사이드바 접힘/펼침 등 부모 크기 변화를 Leaflet이 스스로 감지하지 못해 지도가 잘리므로,
    // 컨테이너 크기 변화를 직접 관찰해 invalidateSize를 호출한다(트랜지션 도중에도 계속 맞춰짐).
    const resizeObserver = new ResizeObserver(() => map.invalidateSize());
    resizeObserver.observe(containerRef.current);

    return () => {
      map.off("zoomend", onViewChanged);
      map.off("moveend", onMoveEnded);
      if (programmaticMoveTimerRef.current != null) {
        window.clearTimeout(programmaticMoveTimerRef.current);
        programmaticMoveTimerRef.current = null;
      }
      if (!pendingProgrammaticViewRef.current) {
        saveMapViewState(map);
      }
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      polysRef.current.clear();
    };
    // selectedId는 마운트 시점 값만 참조(최초 flownRef 초기화용)하므로 의도적으로 deps에서 제외.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // 3) 선택 강조 + 이동 + 팝업 (selectedId가 null이면 선택 해제 → 서울 전역 뷰로 줌아웃)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (selectedId == null) {
      polysRef.current.forEach((lyr) => {
        const c = scoreColor(
          (lyr as L.Path & { feature?: GeoJSON.Feature }).feature?.properties?.district_score as number | null,
        );
        lyr.setStyle({ weight: 1, opacity: 0.65, fillColor: c, fillOpacity: 0.22, color: c });
        lyr.closePopup();
      });
      pinMarkersRef.current.forEach((m) => m.closePopup());
      flownRef.current = null;
      markProgrammaticMove(map);
      map.flyTo(SEOUL_CENTER, 12, { duration: 0.8 });
      return;
    }

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
        const bounds = sel.getBounds();
        markProgrammaticMove(map);
        map.flyToBounds(bounds, { padding: [80, 80], maxZoom: 17, duration: 0.8 });
      }
      sel.bindPopup(buildPopup(selectedId), { closeButton: true, minWidth: 170 });
      // 팝업 자동 오픈은 카메라 이동(isNewSelection) 여부와 별개다: 마운트 시 카메라를 조용히
      // 유지하는 경우(흔들림 방지)에도 선택된 상권의 팝업만큼은 처음 한 번은 자동으로 띄운다.
      if (isNewSelection || wasOpen || !initialPopupShownRef.current) sel.openPopup();
      initialPopupShownRef.current = true;
    } else {
      // 폴리곤이 없을 때(핀 모드): 선택된 핀으로 이동하고 팝업을 연다.
      const pin = pinMarkersRef.current.get(selectedId);
      if (pin) {
        const wasOpen = pin.isPopupOpen();
        if (isNewSelection) {
          flownRef.current = selectedId;
          markProgrammaticMove(map);
          map.flyTo(pin.getLatLng(), 15, { duration: 0.8 });
        }
        // 최신 상권 정보(activeName/type/score)로 팝업을 새로 바인딩한다.
        pin.bindPopup(buildPopup(selectedId), { closeButton: true, minWidth: 170 });
        if (isNewSelection || wasOpen || !initialPopupShownRef.current) pin.openPopup();
        initialPopupShownRef.current = true;
      }
    }
    // geojson/pins도 의존성에 포함: 데이터가 늦게 도착해 selectedId의 구역·핀이 뒤늦게 생기는 경우를 다시 시도한다.
  }, [selectedId, activeName, activeType, activeScore, geojson, pins]); // eslint-disable-line react-hooks/exhaustive-deps

  // 4) 자치구 필터 변경 시 해당 자치구 범위로 카메라 이동
  useEffect(() => {
    if (!guFilterMountedRef.current) {
      guFilterMountedRef.current = true;
      return;
    }
    const map = mapRef.current;
    if (!map) return;
    if (!guFilterReadyRef.current) {
      guFilterReadyRef.current = true;
      return;
    }
    if (guFilter === "전체") {
      markProgrammaticMove(map);
      map.flyTo(SEOUL_CENTER, 12, { duration: 0.8 });
      return;
    }
    if (points.length === 0) return;
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    markProgrammaticMove(map);
    map.flyToBounds(bounds, { padding: [64, 64], maxZoom: 16, duration: 0.8 });
  }, [guFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // 5) 순위 핑 마커: pins 변경 시 전부 다시 그리고, 핑 전체가 보이도록 카메라를 맞춘다.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    pinsLayerRef.current?.remove();
    pinsLayerRef.current = null;
    pinMarkersRef.current.clear();
    if (!pins || pins.length === 0) return;

    const markers = pins.map((p) => {
      const marker = L.marker([p.lat, p.lng], {
        icon: L.divIcon({
          className: styles.pinWrap,
          html: `<span class="${styles.pinBadge}"><span>${p.label}</span></span>`,
          iconSize: [28, 28],
          // 물방울 꼬리(회전된 모서리)가 좌표를 가리키도록 앵커를 아이콘 박스 아래로 둔다.
          iconAnchor: [14, 34],
        }),
        zIndexOffset: 1000,
      })
        .on("click", () => onSelectRef.current(p.id))
        .bindTooltip(p.name, { direction: "top", offset: [0, -34] });
      // 팝업은 폴리곤과 동일하게 선택 시(effect 3)에 최신 상권 정보로 바인딩한다.
      // (여기서 미리 바인딩하면 activeName 등이 아직 null이라 빈 팝업이 뜬다.)
      pinMarkersRef.current.set(p.id, marker);
      return marker;
    });
    const group = L.layerGroup(markers);
    pinsLayerRef.current = group;
    group.addTo(map);

    const bounds = L.latLngBounds(pins.map((p) => [p.lat, p.lng] as [number, number]));
    if (bounds.isValid()) {
      markProgrammaticMove(map);
      map.flyToBounds(bounds, { padding: [60, 60], maxZoom: 15, duration: 0.8 });
    }
  }, [pins]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} className={styles.map} aria-label="상권 지도" />;
}
