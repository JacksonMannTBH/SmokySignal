"use client";

// 30-day heatmap for a single tail, rendered on /plane/[tail]. Fetches
// /api/plane/[tail]/heatmap once on mount, then renders a small dark
// MapLibre map with a single heatmap layer auto-fit to the cells.
//
// Uses the same paint expressions as components/HotZoneLayer.tsx so the
// rendering reads as the "same" heatmap visually — just one tail's
// share of it. Diverges only on opacity (a touch dimmer here, since
// the panel sits inside a card and shouldn't compete with the page).

import { useEffect, useRef, useState } from "react";
import maplibregl, { Map as MaplibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MAP_STYLE_URL } from "@/lib/map-style";
import { SS_TOKENS } from "@/lib/tokens";
import type { HotZone } from "@/lib/hotzones";

const PUGET_SOUND: [number, number] = [-122.3, 47.6];
const DEFAULT_ZOOM = 8;
const PANEL_HEIGHT = 220;

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; zones: HotZone[] };

export default function PerPlaneHeatLayer({ tail }: { tail: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/plane/${tail}/heatmap`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = (await r.json()) as { zones?: HotZone[] };
        if (cancelled) return;
        setState({ kind: "ready", zones: d.zones ?? [] });
      })
      .catch(() => {
        if (!cancelled) {
          setState({ kind: "error", message: "Heatmap unavailable" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tail]);

  useEffect(() => {
    if (state.kind !== "ready" || state.zones.length === 0) return;
    if (!containerRef.current) return;
    const zones = state.zones;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: PUGET_SOUND,
      zoom: DEFAULT_ZOOM,
      attributionControl: { compact: true },
      interactive: true,
    });
    mapRef.current = map;

    map.on("load", () => {
      const features = zones.map((z) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [z.lon, z.lat] },
        properties: { weight: Math.log10(z.count + 1) },
      }));
      map.addSource("heat", {
        type: "geojson",
        data: { type: "FeatureCollection", features },
      });
      map.addLayer({
        id: "heat",
        type: "heatmap",
        source: "heat",
        paint: {
          "heatmap-weight": ["get", "weight"],
          "heatmap-intensity": [
            "interpolate", ["linear"], ["zoom"], 6, 0.6, 14, 1.0,
          ],
          "heatmap-radius": [
            "interpolate", ["linear"], ["zoom"], 6, 14, 14, 28,
          ],
          "heatmap-opacity": [
            "interpolate", ["linear"], ["zoom"], 6, 0.65, 14, 0.45,
          ],
          "heatmap-color": [
            "interpolate", ["linear"], ["heatmap-density"],
            0, "rgba(0,0,0,0)",
            0.2, "rgba(255,193,7,0.30)",
            0.5, "rgba(255,123,0,0.60)",
            1.0, "rgba(255,0,0,0.85)",
          ],
        },
      });
      let minLat = Infinity, maxLat = -Infinity;
      let minLon = Infinity, maxLon = -Infinity;
      for (const z of zones) {
        if (z.lat < minLat) minLat = z.lat;
        if (z.lat > maxLat) maxLat = z.lat;
        if (z.lon < minLon) minLon = z.lon;
        if (z.lon > maxLon) maxLon = z.lon;
      }
      map.fitBounds(
        [[minLon, minLat], [maxLon, maxLat]],
        { padding: 30, duration: 0, maxZoom: 11 },
      );
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [state]);

  if (state.kind === "loading") {
    return (
      <div
        style={{ height: PANEL_HEIGHT, background: SS_TOKENS.bg0 }}
        aria-label="Loading patrol heatmap"
      />
    );
  }
  if (state.kind === "error") {
    return (
      <div
        style={{
          padding: "16px 14px",
          fontSize: 12.5,
          color: SS_TOKENS.fg2,
          textAlign: "center",
        }}
      >
        {state.message}
      </div>
    );
  }
  if (state.zones.length === 0) {
    return (
      <div
        style={{
          padding: "16px 14px",
          fontSize: 12.5,
          color: SS_TOKENS.fg2,
          textAlign: "center",
        }}
      >
        No flight data in the last 30 days.
      </div>
    );
  }
  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={`30-day patrol heatmap for ${tail}`}
      style={{
        position: "relative",
        height: PANEL_HEIGHT,
        background: SS_TOKENS.bg0,
      }}
    />
  );
}
