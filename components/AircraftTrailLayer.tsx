"use client";

// Polls /api/trails for the currently-airborne tail set and renders a
// solid amber polyline + endpoint dots behind each plane on /radar.
// Sits BELOW the "aircraft" symbol layer so the chevron stays visually
// on top, but ABOVE the hot-zones-heat + flight-paths-line layers so
// the trail isn't buried under the density treatments. moveLayer
// reordering happens after attach + on every data poll because the
// other layers can race-mount in either order.
//
// Visual treatment matches /plane/[tail] (PlaneTrackMap.tsx) so the
// rider sees the same trail aesthetic on the main radar and the detail
// page: solid alert-amber line at zoom-interpolated width, green
// start-dot, amber end-dot that pulses while the tail is airborne.
// The prior sky-blue gradient retired post-PROMPT_19 — invisible
// against the heatmap shipping over the same map.

import { useEffect, useRef } from "react";
import type { Map as MaplibreMap, GeoJSONSource } from "maplibre-gl";
import { SS_TOKENS } from "@/lib/tokens";
import type { Aircraft } from "@/lib/types";

const SOURCE_ID = "aircraft-trails";
const ENDPOINTS_SOURCE_ID = "aircraft-trail-endpoints";
const LAYER_ID = "aircraft-trail";
const START_DOT_LAYER_ID = "aircraft-trail-start-dot";
const END_DOT_LAYER_ID = "aircraft-trail-end-dot";
const AIRCRAFT_LAYER_ID = "aircraft";
const POLL_MS = 10_000;
const TRAIL_MINUTES = 30;
const PULSE_PERIOD_MS = 1600;

type TrailPoint = { lat: number; lon: number; ts: number };
type TrailsResponse = { trails: Record<string, TrailPoint[]> };

type EndpointKind = "start" | "end";
type EndpointProps = { tail: string; kind: EndpointKind };

function buildFeatureCollection(
  trails: Record<string, TrailPoint[]>,
): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  const features: GeoJSON.Feature<GeoJSON.LineString>[] = [];
  for (const [tail, pts] of Object.entries(trails)) {
    if (pts.length < 2) continue;
    features.push({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: pts.map((p) => [p.lon, p.lat]),
      },
      properties: { tail },
    });
  }
  return { type: "FeatureCollection", features };
}

function buildEndpointCollection(
  trails: Record<string, TrailPoint[]>,
): GeoJSON.FeatureCollection<GeoJSON.Point, EndpointProps> {
  const features: GeoJSON.Feature<GeoJSON.Point, EndpointProps>[] = [];
  for (const [tail, pts] of Object.entries(trails)) {
    if (pts.length < 2) continue;
    const start = pts[0]!;
    const end = pts[pts.length - 1]!;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [start.lon, start.lat] },
      properties: { tail, kind: "start" },
    });
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [end.lon, end.lat] },
      properties: { tail, kind: "end" },
    });
  }
  return { type: "FeatureCollection", features };
}

/**
 * Try to position the trail layer + its dot layers above the density
 * treatments (hot-zones-heat, flight-paths-line) but below the aircraft
 * chevrons. moveLayer is idempotent + cheap so calling it on every
 * poll keeps z-order correct even if a sibling layer mounts later.
 */
function reorderTrailLayers(map: MaplibreMap): void {
  const beforeId = map.getLayer(AIRCRAFT_LAYER_ID)
    ? AIRCRAFT_LAYER_ID
    : undefined;
  for (const id of [LAYER_ID, START_DOT_LAYER_ID, END_DOT_LAYER_ID]) {
    try {
      if (map.getLayer(id)) map.moveLayer(id, beforeId);
    } catch {
      /* layer torn down mid-call */
    }
  }
}

export function AircraftTrailLayer({
  map,
  airborne,
}: {
  map: MaplibreMap | null;
  airborne: Aircraft[];
}) {
  const tailsKey = airborne
    .map((a) => a.tail)
    .filter(Boolean)
    .sort()
    .join(",");
  const tailsKeyRef = useRef(tailsKey);
  tailsKeyRef.current = tailsKey;
  const pulseRef = useRef<number | null>(null);

  // Layer attachment — once per map instance.
  useEffect(() => {
    if (!map) return;
    const attach = () => {
      if (!map.isStyleLoaded() || map.getSource(SOURCE_ID)) return;
      const beforeId = map.getLayer(AIRCRAFT_LAYER_ID)
        ? AIRCRAFT_LAYER_ID
        : undefined;
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addSource(ENDPOINTS_SOURCE_ID, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer(
        {
          id: LAYER_ID,
          type: "line",
          source: SOURCE_ID,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": SS_TOKENS.alert,
            "line-width": [
              "interpolate",
              ["linear"],
              ["zoom"],
              8,
              2,
              11,
              3,
              14,
              3.5,
              18,
              4,
            ],
            "line-opacity": 0.85,
          },
        },
        beforeId,
      );
      map.addLayer(
        {
          id: START_DOT_LAYER_ID,
          type: "circle",
          source: ENDPOINTS_SOURCE_ID,
          filter: ["==", ["get", "kind"], "start"],
          paint: {
            "circle-radius": 5,
            "circle-color": SS_TOKENS.clear,
            "circle-stroke-color": "#FFFFFF",
            "circle-stroke-width": 1.5,
          },
        },
        beforeId,
      );
      map.addLayer(
        {
          id: END_DOT_LAYER_ID,
          type: "circle",
          source: ENDPOINTS_SOURCE_ID,
          filter: ["==", ["get", "kind"], "end"],
          paint: {
            "circle-radius": 6,
            "circle-color": SS_TOKENS.alert,
            "circle-stroke-color": "#FFFFFF",
            "circle-stroke-width": 1.5,
          },
        },
        beforeId,
      );
      // Settle z-order after sibling layers (heatmap, flight-paths)
      // race-mount on first paint. setTimeout 0 because moveLayer
      // throws if the heatmap hasn't attached yet.
      window.setTimeout(() => reorderTrailLayers(map), 0);
    };
    if (map.isStyleLoaded()) attach();
    map.on("load", attach);
    map.on("styledata", attach);

    // Pulse the end dot every animation frame. setPaintProperty is
    // cheap and the radius expression covers every airborne tail in
    // a single layer (filter handles which features show).
    const startedAt = Date.now();
    const tick = () => {
      if (!mapAlive(map) || !map.getLayer(END_DOT_LAYER_ID)) {
        pulseRef.current = requestAnimationFrame(tick);
        return;
      }
      const phase = ((Date.now() - startedAt) % PULSE_PERIOD_MS) / PULSE_PERIOD_MS;
      const radius = 6 + 4 * Math.sin(phase * Math.PI * 2);
      try {
        map.setPaintProperty(END_DOT_LAYER_ID, "circle-radius", radius);
      } catch {
        /* layer torn down mid-frame */
      }
      pulseRef.current = requestAnimationFrame(tick);
    };
    pulseRef.current = requestAnimationFrame(tick);

    return () => {
      map.off("load", attach);
      map.off("styledata", attach);
      if (pulseRef.current != null) cancelAnimationFrame(pulseRef.current);
      pulseRef.current = null;
      try {
        if (map.getLayer(END_DOT_LAYER_ID)) map.removeLayer(END_DOT_LAYER_ID);
        if (map.getLayer(START_DOT_LAYER_ID)) map.removeLayer(START_DOT_LAYER_ID);
        if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
        if (map.getSource(ENDPOINTS_SOURCE_ID)) map.removeSource(ENDPOINTS_SOURCE_ID);
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      } catch {
        // map torn down already
      }
    };
  }, [map]);

  // Poll /api/trails whenever the airborne tail set changes, plus every
  // POLL_MS while it's stable. Cancel + restart cleanly if tails change
  // mid-cycle so we never write a stale set to the source.
  useEffect(() => {
    if (!map) return;
    if (!tailsKey) {
      // No airborne tails — clear both sources.
      const lineSrc = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      if (lineSrc) lineSrc.setData({ type: "FeatureCollection", features: [] });
      const endpointSrc = map.getSource(ENDPOINTS_SOURCE_ID) as
        | GeoJSONSource
        | undefined;
      if (endpointSrc) {
        endpointSrc.setData({ type: "FeatureCollection", features: [] });
      }
      return;
    }
    let cancelled = false;
    const fetchOnce = async () => {
      try {
        const r = await fetch(
          `/api/trails?tails=${tailsKey}&minutes=${TRAIL_MINUTES}`,
          { cache: "no-store" },
        );
        if (!r.ok || cancelled) return;
        const d = (await r.json()) as TrailsResponse;
        if (cancelled) return;
        // Tails may have shifted while the fetch was in flight; bail if so
        // to avoid painting stale data over a fresh-tail snapshot.
        if (tailsKeyRef.current !== tailsKey) return;
        const trails = d.trails ?? {};
        const lineSrc = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
        if (lineSrc) lineSrc.setData(buildFeatureCollection(trails));
        const endpointSrc = map.getSource(ENDPOINTS_SOURCE_ID) as
          | GeoJSONSource
          | undefined;
        if (endpointSrc) {
          endpointSrc.setData(buildEndpointCollection(trails));
        }
        // Refresh z-order in case heatmap or flight-paths attached
        // after the trail did.
        reorderTrailLayers(map);
      } catch {
        // transient — try again next tick
      }
    };
    fetchOnce();
    const id = window.setInterval(fetchOnce, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [map, tailsKey]);

  return null;
}

/** True iff the map instance is still mounted (defensive — MapLibre
 *  doesn't expose a public liveness flag). */
function mapAlive(map: MaplibreMap | null): map is MaplibreMap {
  if (!map) return false;
  try {
    map.getCanvas();
    return true;
  } catch {
    return false;
  }
}
