"use client";

// Renders rider-defined geofence circles on the radar map and handles
// tap-to-remove (with a confirm dialog so edge taps aren't destructive).

import { useEffect, useRef } from "react";
import type {
  Map as MaplibreMap,
  GeoJSONSource,
  MapMouseEvent,
  MapGeoJSONFeature,
} from "maplibre-gl";
import {
  readUserZones,
  removeUserZone,
  USER_ZONES_CHANGE_EVENT,
  type UserZone,
} from "@/lib/user-zones";

const SOURCE_ID = "user-zones";
const FILL_LAYER_ID = "user-zones-fill";
const LINE_LAYER_ID = "user-zones-line";
const NM_PER_DEG_LAT = 1 / 60;
const RING_SEGMENTS = 64;

function circleRing(lat: number, lon: number, radiusNm: number): Array<[number, number]> {
  const dLat = radiusNm * NM_PER_DEG_LAT;
  const dLon = dLat / Math.max(0.01, Math.cos((lat * Math.PI) / 180));
  const out: Array<[number, number]> = [];
  for (let i = 0; i <= RING_SEGMENTS; i++) {
    const theta = (i / RING_SEGMENTS) * 2 * Math.PI;
    out.push([lon + dLon * Math.sin(theta), lat + dLat * Math.cos(theta)]);
  }
  return out;
}

function toGeoJSON(zones: UserZone[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: zones.map((z) => ({
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [circleRing(z.lat, z.lon, z.radiusNm)],
      },
      properties: { id: z.id, label: z.label },
    })),
  };
}

export function UserZoneLayer({ map }: { map: MaplibreMap | null }) {
  const zonesRef = useRef<UserZone[]>([]);

  useEffect(() => {
    if (!map) return;
    zonesRef.current = readUserZones();

    const ensureLayer = () => {
      if (!map.isStyleLoaded() || map.getSource(SOURCE_ID)) return;
      const beforeId = map.getLayer("aircraft") ? "aircraft" : undefined;
      map.addSource(SOURCE_ID, { type: "geojson", data: toGeoJSON(zonesRef.current) });
      map.addLayer({
        id: FILL_LAYER_ID,
        type: "fill",
        source: SOURCE_ID,
        paint: { "fill-color": "#8bd2ff", "fill-opacity": 0.1 },
      }, beforeId);
      map.addLayer({
        id: LINE_LAYER_ID,
        type: "line",
        source: SOURCE_ID,
        paint: {
          "line-color": "#8bd2ff",
          "line-opacity": 0.55,
          "line-width": 1,
          "line-dasharray": [2, 2],
        },
      }, beforeId);
    };

    if (map.isStyleLoaded()) ensureLayer();
    map.on("load", ensureLayer);
    map.on("styledata", ensureLayer);

    const onZonesChange = (e: Event) => {
      const detail = (e as CustomEvent<UserZone[]>).detail;
      zonesRef.current = detail ?? readUserZones();
      const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      if (src) src.setData(toGeoJSON(zonesRef.current));
    };
    window.addEventListener(USER_ZONES_CHANGE_EVENT, onZonesChange);

    const onZoneClick = (e: MapMouseEvent & { features?: MapGeoJSONFeature[] }) => {
      // Don't intercept if the same click hit an aircraft chevron — that
      // gesture belongs to follow mode in RadarMap.
      if (map.queryRenderedFeatures(e.point, { layers: ["aircraft"] }).length > 0) return;
      const feat = e.features?.[0];
      const id = feat?.properties?.id;
      const label = feat?.properties?.label ?? "this zone";
      if (typeof id !== "string") return;
      if (window.confirm(`Remove zone "${label}"?`)) removeUserZone(id);
    };
    map.on("click", FILL_LAYER_ID, onZoneClick);

    return () => {
      window.removeEventListener(USER_ZONES_CHANGE_EVENT, onZonesChange);
      map.off("load", ensureLayer);
      map.off("styledata", ensureLayer);
      map.off("click", FILL_LAYER_ID, onZoneClick);
      try {
        if (map.getLayer(LINE_LAYER_ID)) map.removeLayer(LINE_LAYER_ID);
        if (map.getLayer(FILL_LAYER_ID)) map.removeLayer(FILL_LAYER_ID);
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      } catch {
        // map may be torn down already
      }
    };
  }, [map]);

  return null;
}
