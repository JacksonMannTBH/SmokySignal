"use client";

import { useEffect, useRef } from "react";
import maplibregl, {
  Map as MaplibreMap,
  GeoJSONSource,
  MapMouseEvent,
  MapGeoJSONFeature,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MAP_LABEL_FONT, MAP_STYLE_URL } from "@/lib/map-style";
import { SS_TOKENS } from "@/lib/tokens";
import type { Aircraft, FleetRole } from "@/lib/types";
import {
  aircraftSvg,
  glyphRoleFor,
  type GlyphRole,
} from "@/lib/brand/aircraft-glyphs";
import {
  AIRCRAFT_PATH_COLORS,
  aircraftColorForTail,
  aircraftColorIndex,
} from "@/lib/aircraft-colors";
import { REGIONS, type RegionId } from "@/lib/regions";

const PUGET_SOUND: [number, number] = [-122.3, 47.6];
const DEFAULT_ZOOM = 9;
// Street-level zoom used the first time the rider's geolocation resolves
// — opens the map on the rider's actual neighborhood instead of the
// whole Puget Sound region.
const RIDER_ZOOM = 11;

// 1 nautical mile in degrees latitude (constant). Longitude varies with
// latitude — use cos(lat) to scale per-ring.
const NM_PER_DEG_LAT = 1 / 60;
const RING_SEGMENTS = 64;

function nmToDegLat(nm: number): number {
  return nm * NM_PER_DEG_LAT;
}

function circleRingCoords(
  centerLat: number,
  centerLon: number,
  radiusNm: number,
): Array<[number, number]> {
  const dLat = nmToDegLat(radiusNm);
  const dLon = dLat / Math.max(0.01, Math.cos((centerLat * Math.PI) / 180));
  const out: Array<[number, number]> = [];
  for (let i = 0; i <= RING_SEGMENTS; i++) {
    const theta = (i / RING_SEGMENTS) * 2 * Math.PI;
    out.push([centerLon + dLon * Math.sin(theta), centerLat + dLat * Math.cos(theta)]);
  }
  return out;
}

// Aircraft glyphs are role-keyed images in MapLibre's image atlas. We
// load one per role at map-init and the symbol layer's icon-image
// expression picks the right one per feature via properties.icon.
// 'unknown' maps to 'aircraft-smokey' (see glyphRoleFor — conservative
// alert default, matches computeStatus()).
const AIRCRAFT_ICON_SIZE = 40; // bitmap raster size; layer `icon-size` scales it
const GLYPH_ROLES: GlyphRole[] = ["smokey", "patrol", "sar", "transport"];

function iconKeyFor(role: GlyphRole, colorIndex: number): string {
  return `aircraft-${role}-${colorIndex}`;
}

function iconForAircraft(
  role: FleetRole | undefined | null,
  tail: string,
): string {
  return iconKeyFor(glyphRoleFor(role), aircraftColorIndex(tail));
}

const RIDER_COLOR = "#8bd2ff";
const RIDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><circle cx="24" cy="24" r="20" fill="${RIDER_COLOR}" fill-opacity="0.10"/><circle cx="24" cy="24" r="12" fill="${RIDER_COLOR}" fill-opacity="0.22"/><circle cx="24" cy="24" r="6" fill="${RIDER_COLOR}" stroke="white" stroke-width="2"/></svg>`;

async function loadSvgBitmap(svg: string, size: number): Promise<ImageBitmap> {
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image(size, size);
    img.src = url;
    await img.decode();
    return await createImageBitmap(img, { resizeWidth: size, resizeHeight: size });
  } finally {
    URL.revokeObjectURL(url);
  }
}

type ThemePaintStore = Map<string, unknown>;
type StyleLayerLike = {
  id: string;
  type?: string;
  layout?: Record<string, unknown>;
  "source-layer"?: string;
};

const CUSTOM_LAYER_PREFIXES = [
  "aircraft",
  "rider",
  "distance-rings",
  "flight-paths",
  "user-zones",
  "hotzones",
];

function isCustomLayer(id: string): boolean {
  return CUSTOM_LAYER_PREFIXES.some((prefix) => id.startsWith(prefix));
}

function rememberPaint(
  map: MaplibreMap,
  store: ThemePaintStore,
  id: string,
  prop: string,
) {
  const key = `${id}::${prop}`;
  if (!store.has(key)) store.set(key, map.getPaintProperty(id, prop));
}

function setThemedPaint(
  map: MaplibreMap,
  store: ThemePaintStore,
  id: string,
  prop: string,
  value: unknown,
) {
  rememberPaint(map, store, id, prop);
  map.setPaintProperty(id, prop, value);
}

function restoreMapTheme(map: MaplibreMap, store: ThemePaintStore) {
  for (const [key, value] of store.entries()) {
    const [id, prop] = key.split("::");
    if (!id || !prop || !map.getLayer(id)) continue;
    try {
      map.setPaintProperty(id, prop, value);
    } catch {
      /* style changed while toggling */
    }
  }
  store.clear();
}

function applyRadarMapTheme(
  map: MaplibreMap,
  darkMode: boolean,
  store: ThemePaintStore,
) {
  if (!darkMode) {
    restoreMapTheme(map, store);
    return;
  }

  const layers = (map.getStyle().layers ?? []) as StyleLayerLike[];
  for (const layer of layers) {
    const id = layer.id;
    if (isCustomLayer(id)) continue;
    const type = layer.type;
    const label = `${id} ${layer["source-layer"] ?? ""}`.toLowerCase();
    const isWater = /water|ocean|lake|river|bay|marine/.test(label);
    const isRoad = /road|street|highway|motorway|transport/.test(label);
    const isBoundary = /boundary|admin|state|county/.test(label);
    const isGreenSpace = /park|forest|wood|grass|landcover|landuse/.test(label);
    const hasText = Boolean(layer.layout?.["text-field"]);

    try {
      if (type === "background") {
        setThemedPaint(map, store, id, "background-color", "#111313");
      } else if (type === "fill") {
        setThemedPaint(
          map,
          store,
          id,
          "fill-color",
          isWater ? "#000000" : isGreenSpace ? "#202a22" : "#202426",
        );
        if (!isWater) {
          setThemedPaint(map, store, id, "fill-opacity", 1);
        }
      } else if (type === "line") {
        setThemedPaint(
          map,
          store,
          id,
          "line-color",
          isWater ? "#000000" : isRoad ? "#8ef6c6" : isBoundary ? "#3a3a35" : "#242728",
        );
        if (isRoad || isBoundary) {
          setThemedPaint(map, store, id, "line-opacity", 0.78);
        }
      }

      if (type === "symbol" && hasText) {
        setThemedPaint(map, store, id, "text-color", "#e8e0c8");
        setThemedPaint(map, store, id, "text-halo-color", "#050505");
        setThemedPaint(map, store, id, "text-halo-width", 1.6);
      }
    } catch {
      /* Some provider layers do not support every paint property. */
    }
  }
}

function applyCustomRadarLayerTheme(map: MaplibreMap, darkMode: boolean) {
  const ringColor = darkMode ? "#a9a28a" : "#5c5642";
  const haloColor = darkMode ? "#020202" : "#ffffff";
  try {
    if (map.getLayer("distance-rings")) {
      map.setPaintProperty("distance-rings", "line-color", ringColor);
    }
    if (map.getLayer("distance-rings-labels")) {
      map.setPaintProperty("distance-rings-labels", "text-color", ringColor);
      map.setPaintProperty("distance-rings-labels", "text-halo-color", haloColor);
    }
    if (map.getLayer("aircraft")) {
      map.setPaintProperty("aircraft", "text-color", ["get", "color"]);
      map.setPaintProperty("aircraft", "text-halo-color", darkMode ? "#020202" : "#fff7f2");
    }
  } catch {
    /* layer may be mid-style reload */
  }
}

type Snapshot = {
  fromByTail: Map<string, [number, number]>;
  toByTail: Map<string, [number, number]>;
  metaByTail: Map<
    string,
    { icon: string; track: number; nickname: string | null; color: string; label: string }
  >;
  startedAt: number;
};

const EMPTY_SNAPSHOT: Snapshot = {
  fromByTail: new Map(),
  toByTail: new Map(),
  metaByTail: new Map(),
  startedAt: 0,
};

const ANIM_MS = 1000;

// Re-center the map on the followed plane when EITHER:
//   (a) absolute screen distance from center exceeds FOLLOW_RECENTER_PX, OR
//   (b) the plane is within FOLLOW_EDGE_MARGIN of any viewport edge.
// (a) catches a plane orbiting wide across the screen; (b) catches a
// plane creeping toward an edge slowly. Without (b), a plane drifting
// roughly toward a corner could approach the edge without ever crossing
// the absolute-distance threshold.
const FOLLOW_RECENTER_PX = 200;
const FOLLOW_EDGE_MARGIN_RATIO = 0.2;

type RiderPos = { lat: number; lon: number };

export default function RadarMap({
  aircraft,
  rider,
  showDistanceRings = false,
  darkMode = false,
  regionId,
  onMapReady,
}: {
  aircraft: Aircraft[];
  rider: RiderPos | null;
  showDistanceRings?: boolean;
  darkMode?: boolean;
  /** Pivots the map view between Puget Sound / counties / All-WA.
   *  When undefined or "puget_sound", no flyTo — preserves the
   *  existing rider-zoom + auto-recenter behavior. */
  regionId?: RegionId;
  onMapReady?: (map: MaplibreMap | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const readyRef = useRef(false);
  const animRef = useRef<number | null>(null);
  const pulseRef = useRef<number | null>(null);
  const stateRef = useRef<Snapshot>(EMPTY_SNAPSHOT);
  const aircraftRef = useRef<Aircraft[]>(aircraft);
  const riderRef = useRef<RiderPos | null>(rider);
  const showDistanceRingsRef = useRef<boolean>(showDistanceRings);
  const darkModeRef = useRef<boolean>(darkMode);
  const originalPaintRef = useRef<ThemePaintStore>(new Map());
  // Tracks whether we've done the one-time zoom-to-rider on first
  // geolocation resolve. Subsequent rider changes only recenter
  // (the existing 5s loop), they don't change zoom.
  const didFirstRiderZoomRef = useRef<boolean>(false);
  const userInteractedAtRef = useRef<number>(0);
  // Tail the map is currently "following" (click-to-follow). When set,
  // applyAircraft re-centers on this plane each snapshot if it has
  // drifted >FOLLOW_RECENTER_PX from screen center, and the rider
  // auto-recenter loop is suppressed so the two don't fight.
  const followedTailRef = useRef<string | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const onMapReadyRef = useRef(onMapReady);
  onMapReadyRef.current = onMapReady;

  // Mount the map once.
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: PUGET_SOUND,
      zoom: DEFAULT_ZOOM,
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    const onLoad = async () => {
      // Load all four role glyphs in parallel + the rider dot. The map's
      // symbol layer expression picks the right one per feature via
      // properties.icon = "aircraft-${role}".
      const iconEntries = GLYPH_ROLES.flatMap((role) =>
        AIRCRAFT_PATH_COLORS.map((color, colorIndex) => ({
          key: iconKeyFor(role, colorIndex),
          role,
          color,
        })),
      );
      const [riderImg, ...aircraftImgs] = await Promise.all([
        loadSvgBitmap(RIDER_SVG, 48),
        ...iconEntries.map(({ role, color }) =>
          loadSvgBitmap(
            aircraftSvg(role, {
              size: AIRCRAFT_ICON_SIZE,
              tone: "radar",
              color,
            }),
            AIRCRAFT_ICON_SIZE,
          ),
        ),
      ]);
      if (!mapRef.current) return; // guard - unmounted while loading
      map.addImage("rider-dot", riderImg);
      iconEntries.forEach(({ key }, i) => {
        map.addImage(key, aircraftImgs[i]!);
      });
      applyRadarMapTheme(map, darkModeRef.current, originalPaintRef.current);

      // Distance rings — sit beneath the rider so the dot stays on top.
      // Toggleable via showDistanceRings prop; visibility flips without
      // tearing the layer down.
      map.addSource("distance-rings", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "distance-rings",
        type: "line",
        source: "distance-rings",
        layout: {
          visibility: showDistanceRingsRef.current ? "visible" : "none",
        },
        paint: {
          "line-color": "#5c5642",
          "line-opacity": 0.4,
          "line-width": 0.75,
          "line-dasharray": [4, 4],
        },
      });
      // Tiny mono labels at the top of each ring ("5nm" / "10nm" / "15nm")
      // sit on a separate symbol layer so we can keep the line layer pure.
      map.addLayer({
        id: "distance-rings-labels",
        type: "symbol",
        source: "distance-rings",
        layout: {
          visibility: showDistanceRingsRef.current ? "visible" : "none",
          "text-field": ["get", "label"],
          "text-size": 9,
          "text-font": MAP_LABEL_FONT,
          "text-offset": [0, -0.6],
          "text-anchor": "bottom",
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": "#5c5642",
          "text-opacity": 0.8,
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.5,
        },
        // Only render labels for the line vertices we tag — the polygon
        // outlines have no `label` property so they're skipped.
        filter: ["has", "label"],
      });

      // Rider — under aircraft so chevrons stay visually on top, but ABOVE
      // distance rings so the dot stays visually anchored.
      map.addSource("rider", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "rider",
        type: "symbol",
        source: "rider",
        layout: {
          "icon-image": "rider-dot",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          "icon-size": 0.6,
        },
      });

      map.addSource("aircraft", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "aircraft",
        type: "symbol",
        source: "aircraft",
        layout: {
          "icon-image": ["get", "icon"],
          "icon-rotate": ["get", "track"],
          "icon-rotation-alignment": "map",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          "icon-size": 0.95,
          // Tail label stays above the aircraft at every zoom. Let it win
          // placement so a live aircraft never appears nameless.
          // Font stack matches OpenFreeMap's bundled glyphs.
          "text-field": ["get", "label"],
          "text-font": MAP_LABEL_FONT,
          "text-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            6,
            9.5,
            10,
            10,
            14,
            12,
            18,
            13,
          ],
          "text-offset": [0, -1.85],
          "text-anchor": "bottom",
          "text-allow-overlap": true,
          "text-ignore-placement": true,
          "text-line-height": 1.05,
          "text-letter-spacing": 0,
        },
        paint: {
          "text-color": ["get", "color"],
          "text-halo-color": "#fff7f2",
          "text-halo-width": 2,
        },
      });
      applyCustomRadarLayerTheme(map, darkModeRef.current);

      readyRef.current = true;
      applyAircraft(aircraftRef.current);
      applyRider(riderRef.current);
      applyDistanceRings(riderRef.current);
      // Map mounted with rider already known (geolocation resolved
      // before MapLibre finished loading) — do the one-time zoom now.
      if (riderRef.current && !didFirstRiderZoomRef.current) {
        didFirstRiderZoomRef.current = true;
        map.flyTo({
          center: [riderRef.current.lon, riderRef.current.lat],
          zoom: RIDER_ZOOM,
          duration: 1000,
        });
      }
      startPulse();
      onMapReadyRef.current?.(map);
    };
    map.on("load", onLoad);

    // Pause auto-recenter for 15s after any pan or zoom interaction.
    // Distinguish true user gestures from programmatic flyTo/easeTo by the
    // presence of `originalEvent` (only set for browser-driven events) —
    // otherwise our own follow-mode flyTo would self-cancel.
    const onUserInteract = (e?: { originalEvent?: unknown }) => {
      userInteractedAtRef.current = Date.now();
      if (e?.originalEvent && followedTailRef.current) {
        followedTailRef.current = null;
        popupRef.current?.remove();
        popupRef.current = null;
      }
    };
    map.on("dragstart", onUserInteract);
    map.on("zoomstart", onUserInteract);

    // Cursor + click on chevrons.
    const onMouseEnter = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const onMouseLeave = () => {
      map.getCanvas().style.cursor = "";
    };
    const onClick = (e: MapMouseEvent & { features?: MapGeoJSONFeature[] }) => {
      const feat = e.features?.[0];
      const tail = feat?.properties?.tail;
      if (typeof tail !== "string") return;
      const pos = stateRef.current.toByTail.get(tail);
      if (!pos) return;
      followedTailRef.current = tail;
      popupRef.current?.remove();
      const meta = stateRef.current.metaByTail.get(tail);
      const label = meta?.nickname ?? tail;
      const popup = new maplibregl.Popup({
        closeButton: true,
        closeOnClick: false,
        closeOnMove: false,
        offset: 18,
        className: "ss-plane-popup",
      })
        .setLngLat(pos)
        .setHTML(
          `<div style="font:700 12px/1.4 Math Bold,Cambria Math,STIX Two Math,serif;color:${SS_TOKENS.bg0}">` +
            `<div>${label}</div>` +
            `<a href="/plane/${tail}" style="color:${SS_TOKENS.sky};text-decoration:underline;font-weight:400">View detail</a>` +
            `</div>`,
        )
        .addTo(map);
      popup.on("close", () => {
        if (followedTailRef.current === tail) {
          followedTailRef.current = null;
        }
        if (popupRef.current === popup) popupRef.current = null;
      });
      popupRef.current = popup;
      map.flyTo({
        center: pos,
        zoom: Math.max(map.getZoom(), 12),
        duration: 600,
      });
    };
    // Click on empty map (no aircraft hit) → exit follow mode.
    const onMapClick = (e: MapMouseEvent) => {
      if (!followedTailRef.current) return;
      const features = map.queryRenderedFeatures(e.point, {
        layers: ["aircraft"],
      });
      if (features.length > 0) return;
      followedTailRef.current = null;
      popupRef.current?.remove();
      popupRef.current = null;
    };
    map.on("mouseenter", "aircraft", onMouseEnter);
    map.on("mouseleave", "aircraft", onMouseLeave);
    map.on("click", "aircraft", onClick);
    map.on("click", onMapClick);

    return () => {
      readyRef.current = false;
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (pulseRef.current) cancelAnimationFrame(pulseRef.current);
      map.off("load", onLoad);
      map.off("dragstart", onUserInteract);
      map.off("zoomstart", onUserInteract);
      map.off("mouseenter", "aircraft", onMouseEnter);
      map.off("mouseleave", "aircraft", onMouseLeave);
      map.off("click", "aircraft", onClick);
      map.off("click", onMapClick);
      popupRef.current?.remove();
      popupRef.current = null;
      onMapReadyRef.current?.(null);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply rider position when it updates from the geolocation watch.
  // First time the rider resolves AND the map is ready, fly to their
  // position at street-level zoom so a Tacoma rider opens to Tacoma,
  // not to the regional Puget Sound overview.
  useEffect(() => {
    riderRef.current = rider;
    if (readyRef.current) {
      applyRider(rider);
      applyDistanceRings(rider);
      if (rider && !didFirstRiderZoomRef.current && mapRef.current) {
        didFirstRiderZoomRef.current = true;
        // Skip the auto-zoom if the user has already manually panned
        // or zoomed (they meant it).
        if (Date.now() - userInteractedAtRef.current >= 15_000) {
          mapRef.current.flyTo({
            center: [rider.lon, rider.lat],
            zoom: RIDER_ZOOM,
            duration: 1000,
          });
        }
      }
    }
  }, [rider]);

  // Toggle ring visibility without rebuilding the layer.
  useEffect(() => {
    showDistanceRingsRef.current = showDistanceRings;
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const v = showDistanceRings ? "visible" : "none";
    try {
      map.setLayoutProperty("distance-rings", "visibility", v);
      map.setLayoutProperty("distance-rings-labels", "visibility", v);
    } catch {
      /* layer not yet attached */
    }
  }, [showDistanceRings]);

  useEffect(() => {
    darkModeRef.current = darkMode;
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    applyRadarMapTheme(map, darkMode, originalPaintRef.current);
    applyCustomRadarLayerTheme(map, darkMode);
  }, [darkMode]);

  // When the rider changes region (Puget Sound → Spokane etc), fly the
  // map to the region's centroid + default zoom. Skipped on initial
  // mount where regionId starts at "puget_sound" — that's the existing
  // default and a flyTo would feel like a flicker.
  const lastRegionRef = useRef<RegionId | undefined>(regionId);
  useEffect(() => {
    if (!regionId || regionId === lastRegionRef.current) return;
    lastRegionRef.current = regionId;
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const r = REGIONS[regionId];
    if (!r) return;
    map.flyTo({
      center: [r.centerLon, r.centerLat],
      zoom: r.zoomLevel,
      duration: 800,
    });
    // Mark that the user "interacted" so the auto-recenter loop pauses
    // for 15s — otherwise the next 5s tick would yank them back to
    // their geolocation and undo the region pivot.
    userInteractedAtRef.current = Date.now();
  }, [regionId]);

  // Auto-recenter every 5s, paused for 15s after the user pans or zooms.
  // Also paused while a plane is being followed — applyAircraft handles
  // re-centering on the followed tail, and we don't want to fight it.
  useEffect(() => {
    if (!rider) return;
    const id = setInterval(() => {
      if (!readyRef.current || !mapRef.current) return;
      if (Date.now() - userInteractedAtRef.current < 15_000) return;
      if (followedTailRef.current) return;
      const r = riderRef.current;
      if (!r) return;
      mapRef.current.easeTo({
        center: [r.lon, r.lat],
        duration: 800,
      });
    }, 5_000);
    return () => clearInterval(id);
  }, [rider]);

  function startPulse() {
    const map = mapRef.current;
    if (!map) return;
    const start = Date.now();
    const tick = () => {
      const phase = (Date.now() - start) / 1600; // 1.6s loop
      const sized = 0.86 + 0.14 * (Math.sin(phase * Math.PI * 2) + 1);
      try {
        map.setLayoutProperty("rider", "icon-size", sized);
      } catch {
        // Layer may not exist yet; ignore.
      }
      pulseRef.current = requestAnimationFrame(tick);
    };
    pulseRef.current = requestAnimationFrame(tick);
  }

  function applyDistanceRings(pos: RiderPos | null) {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource("distance-rings") as GeoJSONSource | undefined;
    if (!source) return;
    if (!pos) {
      source.setData({ type: "FeatureCollection", features: [] });
      return;
    }
    const RINGS_NM = [5, 10, 15] as const;
    const features: GeoJSON.Feature[] = [];
    for (const nm of RINGS_NM) {
      features.push({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: circleRingCoords(pos.lat, pos.lon, nm),
        },
        properties: {},
      });
      // Label at the top (north) edge of each ring.
      const labelLat = pos.lat + nmToDegLat(nm);
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [pos.lon, labelLat] },
        properties: { label: `${nm}nm` },
      });
    }
    source.setData({ type: "FeatureCollection", features });
  }

  function applyRider(pos: RiderPos | null) {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource("rider") as GeoJSONSource | undefined;
    if (!source) return;
    if (!pos) {
      source.setData({ type: "FeatureCollection", features: [] });
      return;
    }
    source.setData({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [pos.lon, pos.lat] },
          properties: {},
        },
      ],
    });
  }

  // Re-render features when aircraft updates.
  useEffect(() => {
    aircraftRef.current = aircraft;
    if (readyRef.current) applyAircraft(aircraft);
  }, [aircraft]);

  // Compute new from/to and start a 1s linear interp.
  function applyAircraft(list: Aircraft[]) {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource("aircraft") as GeoJSONSource | undefined;
    if (!source) return;

    const now = Date.now();
    const prev = stateRef.current;
    const t = prev.startedAt
      ? Math.min(1, (now - prev.startedAt) / ANIM_MS)
      : 1;

    // Snapshot: where each plane visually is right now.
    const newFrom = new Map<string, [number, number]>();
    for (const [tail, to] of prev.toByTail) {
      const from = prev.fromByTail.get(tail) ?? to;
      const lon = from[0] + (to[0] - from[0]) * t;
      const lat = from[1] + (to[1] - from[1]) * t;
      newFrom.set(tail, [lon, lat]);
    }

    const newTo = new Map<string, [number, number]>();
    const newMeta = new Map<
      string,
      {
        icon: string;
        track: number;
        nickname: string | null;
        color: string;
        label: string;
      }
    >();
    for (const a of list) {
      if (a.lat == null || a.lon == null) continue;
      const color = aircraftColorForTail(a.tail);
      newTo.set(a.tail, [a.lon, a.lat]);
      newMeta.set(a.tail, {
        icon: iconForAircraft(a.role, a.tail),
        track: a.heading ?? 0,
        nickname: a.nickname,
        color,
        label: a.nickname ? `${a.tail}\n${a.nickname}` : a.tail,
      });
      if (!newFrom.has(a.tail)) {
        // First time we see this plane — render it at its current position
        // immediately (no fly-in animation from undefined).
        newFrom.set(a.tail, [a.lon, a.lat]);
      }
    }

    stateRef.current = {
      fromByTail: newFrom,
      toByTail: newTo,
      metaByTail: newMeta,
      startedAt: now,
    };

    // Follow-mode recenter — once per snapshot, when the plane has drifted
    // either >FOLLOW_RECENTER_PX from center OR within FOLLOW_EDGE_MARGIN
    // of any viewport edge. If the plane has dropped out of the snapshot
    // (left the region, went offline), exit follow mode silently.
    const followedTail = followedTailRef.current;
    if (followedTail) {
      const pos = newTo.get(followedTail);
      if (pos) {
        popupRef.current?.setLngLat(pos);
        const screen = map.project(pos);
        const canvas = map.getCanvas();
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        const cx = w / 2;
        const cy = h / 2;
        const dx = screen.x - cx;
        const dy = screen.y - cy;
        const farFromCenter = Math.hypot(dx, dy) > FOLLOW_RECENTER_PX;
        const edgeMarginX = w * FOLLOW_EDGE_MARGIN_RATIO;
        const edgeMarginY = h * FOLLOW_EDGE_MARGIN_RATIO;
        const nearEdge =
          screen.x < edgeMarginX ||
          screen.x > w - edgeMarginX ||
          screen.y < edgeMarginY ||
          screen.y > h - edgeMarginY;
        if (farFromCenter || nearEdge) {
          map.easeTo({ center: pos, duration: 600 });
        }
      } else {
        followedTailRef.current = null;
        popupRef.current?.remove();
        popupRef.current = null;
      }
    }

    if (animRef.current) cancelAnimationFrame(animRef.current);
    const tick = () => {
      const elapsed = (Date.now() - stateRef.current.startedAt) / ANIM_MS;
      const tt = Math.min(1, elapsed);
      const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
      for (const [tail, to] of stateRef.current.toByTail) {
        const from = stateRef.current.fromByTail.get(tail)!;
        const meta = stateRef.current.metaByTail.get(tail)!;
        const lon = from[0] + (to[0] - from[0]) * tt;
        const lat = from[1] + (to[1] - from[1]) * tt;
        const props: Record<string, string | number> = {
          tail,
          icon: meta.icon,
          track: meta.track,
          color: meta.color,
          label: meta.label,
        };
        if (meta.nickname) props.nickname = meta.nickname;
        features.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: [lon, lat] },
          properties: props,
        });
      }
      source.setData({ type: "FeatureCollection", features });
      if (tt < 1) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        animRef.current = null;
      }
    };
    tick();
  }

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label={`Live aircraft map, showing ${aircraft.length} airborne tail${aircraft.length === 1 ? "" : "s"}`}
      style={{
        position: "absolute",
        inset: 0,
        background: darkMode ? "#000000" : SS_TOKENS.bg0,
      }}
    />
  );
}
