"use client";

// Polls /api/trails for the currently-airborne tail set and renders
// a polyline behind each plane on /radar.
//
// PROMPT_19C strip-back: three prior paint prompts (19, 19A, 19B) all
// shipped clean and the trail still wasn't visible on prod. The bug
// isn't paint. This iteration cuts the layer back to the absolute
// simplest configuration that could possibly work — one line layer,
// no halo, no endpoint dots, no reorderTrailLayers, no beforeId,
// 16 px solid cyan added to the top of the layer stack. If this
// renders, the prior bugs were halo / dot / ordering interactions.
// If it still doesn't, the [trail] console.debug logs at every step
// of the data path tell us exactly which call is failing.
//
// Halo, endpoint dots, semantic z-ordering rebuild in the follow-up
// PR once the underlying flow is verified.

import { useEffect, useRef } from "react";
import type { Map as MaplibreMap, GeoJSONSource } from "maplibre-gl";
import { SS_TOKENS } from "@/lib/tokens";
import type { Aircraft } from "@/lib/types";

const SOURCE_ID = "aircraft-trails";
const LAYER_ID = "aircraft-trail";
const POLL_MS = 10_000;
const TRAIL_MINUTES = 30;

type TrailPoint = { lat: number; lon: number; ts: number };
type TrailsResponse = { trails: Record<string, TrailPoint[]> };

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

  // Layer attachment — once per map instance.
  useEffect(() => {
    if (!map) return;
    const attach = () => {
      if (!map.isStyleLoaded() || map.getSource(SOURCE_ID)) return;
      console.debug("[trail] attach: adding source + layer");
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      // No beforeId — layer goes to the top of the stack so it sits
      // above the heatmap, flight-paths, and even the chevron. If a
      // top-of-stack 16 px cyan line doesn't render, the bug isn't
      // ordering. Nuclear-simple while we diagnose.
      map.addLayer({
        id: LAYER_ID,
        type: "line",
        source: SOURCE_ID,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": SS_TOKENS.sky,
          "line-width": 16,
          "line-opacity": 1.0,
        },
      });
      console.debug("[trail] attach: complete", {
        sourceExists: !!map.getSource(SOURCE_ID),
        layerExists: !!map.getLayer(LAYER_ID),
        totalLayers: map.getStyle()?.layers?.length ?? 0,
      });
    };
    if (map.isStyleLoaded()) attach();
    map.on("load", attach);
    map.on("styledata", attach);

    return () => {
      map.off("load", attach);
      map.off("styledata", attach);
      try {
        if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
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
      console.debug("[trail] no airborne tails, clearing source");
      const lineSrc = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      if (lineSrc) lineSrc.setData({ type: "FeatureCollection", features: [] });
      return;
    }
    let cancelled = false;
    const fetchOnce = async () => {
      console.debug("[trail] fetchOnce start", { tailsKey });
      try {
        const r = await fetch(
          `/api/trails?tails=${tailsKey}&minutes=${TRAIL_MINUTES}`,
          { cache: "no-store" },
        );
        if (!r.ok) {
          console.warn("[trail] fetchOnce: bad response", r.status);
          return;
        }
        if (cancelled) return;
        const d = (await r.json()) as TrailsResponse;
        if (cancelled) return;
        if (tailsKeyRef.current !== tailsKey) {
          console.debug("[trail] fetchOnce: stale tailsKey, bailing");
          return;
        }
        const trails = d.trails ?? {};
        const totalPoints = Object.values(trails).reduce(
          (acc, pts) => acc + pts.length,
          0,
        );
        console.debug("[trail] fetchOnce: data received", {
          tails: Object.keys(trails),
          totalPoints,
        });
        const lineSrc = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
        if (!lineSrc) {
          console.warn("[trail] fetchOnce: source missing, skipping setData");
          return;
        }
        const fc = buildFeatureCollection(trails);
        lineSrc.setData(fc);
        console.debug("[trail] fetchOnce: setData complete", {
          featureCount: fc.features.length,
        });
      } catch (e) {
        console.warn("[trail] fetchOnce: threw", e);
      }
    };
    void fetchOnce();
    const id = window.setInterval(fetchOnce, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [map, tailsKey]);

  return null;
}
