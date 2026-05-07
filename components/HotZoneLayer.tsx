"use client";

// Renders a MapLibre heatmap layer on the radar map for our 30-day grid
// aggregate of fleet-aircraft pings (lib/hotzones.ts). Owns:
//   - the source + heatmap layer lifecycle on the passed-in map
//   - the bottom-left toggle button (visibility) + chevron filter panel
//   - localStorage persistence for both visibility and filter
//   - re-fetching /api/hotzones whenever the filter changes
//
// Layer is added BELOW the "aircraft" symbol layer so chevrons stay on top.

import { useEffect, useRef, useState } from "react";
import type { Map as MaplibreMap, GeoJSONSource } from "maplibre-gl";
import { SS_TOKENS } from "@/lib/tokens";
import type { HotZone } from "@/lib/hotzones";
import type { LearningState } from "@/lib/learning";
import {
  DEFAULT_RADAR_FILTER,
  RADAR_FILTER_CHANGE_EVENT,
  SMOKY_FILTER_ROLES,
  readRadarFilter,
  writeRadarFilter,
  type RadarFilter as Filter,
} from "@/lib/radar-filter";
import { REGION_CHANGE_EVENT, getRegion } from "@/lib/region-pref";
import type { RegionId } from "@/lib/regions";
import { Tooltip } from "./Tooltip";
import { LearningPanel } from "./LearningPanel";
import { FilterPanel } from "./FilterPanel";

const VISIBLE_KEY = "ss_hotzones_visible";
const SOURCE_ID = "hotzones";
const LAYER_ID = "hotzones-heat";
const AIRCRAFT_LAYER_ID = "aircraft";
const TABBAR_HEIGHT = 66;

const DEFAULT_FILTER = DEFAULT_RADAR_FILTER;

function buildQueryString(f: Filter, regionId: RegionId): string {
  const p = new URLSearchParams();
  // The rider's region selector is the only region signal — the
  // FilterPanel's redundant Region group retired in P16.3.
  p.set("region_id", regionId);
  // "Smokey" filter is role-based (smokey + patrol). Server resolves
  // the role list to the matching tail set via the registry, so adding
  // a new fixed-wing smokey to the registry automatically widens the
  // filter without a config change.
  if (f.showMode === "smoky") p.set("roles", SMOKY_FILTER_ROLES.join(","));
  if (f.showMode === "operator" && f.operator) p.set("operator", f.operator);
  // Multi-select role allow-list overrides the showMode role shortcut
  // when present. Server-side /api/hotzones already accepts a
  // comma-separated `roles` value.
  if (f.roles.length > 0) p.set("roles", f.roles.join(","));
  return p.toString();
}

type Props = {
  map: MaplibreMap | null;
  /** Extra px above the tab bar — pass when the airborne carousel is on. */
  bottomBoost?: number;
  learning?: LearningState;
};

export function HotZoneLayer({ map, bottomBoost = 0, learning }: Props) {
  const [enabled, setEnabled] = useState<boolean>(true);
  const [filter, setFilter] = useState<Filter>(DEFAULT_FILTER);
  const [regionId, setRegionId] = useState<RegionId>("puget_sound");
  const [zones, setZones] = useState<HotZone[] | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  // Stable refs so the addLayerOnce closure (captured at attach time)
  // can read current state without re-running its effect.
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  console.log("[HZ] mount/render — map?", !!map, "zones?", zones?.length ?? null);

  // Load persisted state once on mount, and stay in sync with any other
  // component that mutates the shared radar filter (e.g. a future global
  // FilterPanel) via the cross-component change event.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const v = window.localStorage.getItem(VISIBLE_KEY);
    if (v === "0") setEnabled(false);
    else if (v === "1") setEnabled(true);
    setFilter(readRadarFilter());
    setRegionId(getRegion());
    const onFilterChange = (e: Event) => {
      const detail = (e as CustomEvent<Filter>).detail;
      if (detail) setFilter(detail);
    };
    const onRegionChange = (e: Event) => {
      const detail = (e as CustomEvent<{ id: RegionId }>).detail;
      setRegionId(detail?.id ?? getRegion());
    };
    window.addEventListener(RADAR_FILTER_CHANGE_EVENT, onFilterChange);
    window.addEventListener(REGION_CHANGE_EVENT, onRegionChange);
    return () => {
      window.removeEventListener(RADAR_FILTER_CHANGE_EVENT, onFilterChange);
      window.removeEventListener(REGION_CHANGE_EVENT, onRegionChange);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(VISIBLE_KEY, enabled ? "1" : "0");
  }, [enabled]);

  // Persist via the shared writer so the change event fires for any
  // other subscriber (RadarShell, etc) listening for filter updates.
  useEffect(() => {
    writeRadarFilter(filter);
  }, [filter]);

  // Fetch (re-fetch when filter or region pref changes). Each request is
  // small + edge-cached for 5 min so flipping filters or region is cheap.
  useEffect(() => {
    let cancelled = false;
    const qs = buildQueryString(filter, regionId);
    (async () => {
      try {
        const r = await fetch(`/api/hotzones?${qs}`, { cache: "no-store" });
        if (!r.ok) return;
        const d = (await r.json()) as { zones: HotZone[] };
        if (!cancelled) {
          const list = Array.isArray(d.zones) ? d.zones : [];
          console.log("[HZ] fetch ok, count=", list.length);
          setZones(list);
        }
      } catch (e) {
        console.warn("[HZ] fetch threw:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filter, regionId]);

  // ── Effect A: add the source + heatmap layer once when the map is
  // ready. The previous version used map.once("idle", …), but `idle`
  // only fires when the map TRANSITIONS into idle — if we attach
  // after the map has already settled (the common case, since
  // RadarMap calls onMapReady from inside the load handler), the
  // listener never fires and the layer never gets added. Using
  // `load` + `styledata` is the supported pattern.
  useEffect(() => {
    if (!map) return;

    const addLayerOnce = () => {
      console.log(
        "[HZ] addLayerOnce — styleLoaded:",
        map.isStyleLoaded(),
        "hasSource:",
        !!map.getSource(SOURCE_ID),
      );
      if (map.getSource(SOURCE_ID)) return; // idempotent
      try {
        map.addSource(SOURCE_ID, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        console.log("[HZ] addSource fired");
        const beforeId = map.getLayer(AIRCRAFT_LAYER_ID)
          ? AIRCRAFT_LAYER_ID
          : undefined;
        map.addLayer(
          {
            id: LAYER_ID,
            type: "heatmap",
            source: SOURCE_ID,
            layout: {
              visibility: enabledRef.current ? "visible" : "none",
            },
            paint: {
              // log10(count) so a 100-sample cell isn't 100x as bright
              // as a 1-sample cell. count=1 → weight 0.2, count=10 → 0.6,
              // count=100 → 1.0. Diminishing returns past that.
              "heatmap-weight": [
                "interpolate",
                ["linear"],
                ["log10", ["max", ["get", "count"], 1]],
                0,
                0.2,
                2,
                1,
              ],
              // Pull intensity DOWN at low zoom so the regional view
              // reads as a heatmap, not a region-wide alert.
              "heatmap-intensity": [
                "interpolate",
                ["linear"],
                ["zoom"],
                7,
                0.6,
                11,
                1,
              ],
              // Smaller radius at low zoom so cells don't merge into
              // a continuous blob across all of Puget Sound.
              "heatmap-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                7,
                14,
                11,
                28,
              ],
              // Dialed-back opacity stops — same hue progression as before
              // but the top stop is 0.65 instead of 0.78, so dense areas
              // remain readable instead of going solid red.
              "heatmap-color": [
                "interpolate",
                ["linear"],
                ["heatmap-density"],
                0,
                "rgba(0,0,0,0)",
                0.05,
                "rgba(245,184,64,0.15)",
                0.35,
                "rgba(245,184,64,0.45)",
                0.7,
                "rgba(245,140,40,0.55)",
                1.0,
                "rgba(220,38,38,0.65)",
              ],
              "heatmap-opacity": 0.7,
            },
          },
          beforeId,
        );
        console.log("[HZ] addLayer fired");
      } catch (e) {
        console.warn("[HZ] addSource/addLayer threw:", e);
      }
    };

    // MapLibre v5 + Next.js + dynamic-imported map instance: the
    // map's isStyleLoaded() can return false indefinitely even after
    // the map is visually rendered, so polling on it never succeeds
    // (verified — gave up after 76 polls / 6 s with the map clearly
    // loaded). The bulletproof pattern is to attempt addSource/
    // addLayer optimistically and retry on every `data` event until
    // the source actually persists. addSource throws if the style
    // isn't loaded; we catch that and let the next data event
    // re-attempt. Once the source exists, subsequent attempts no-op.
    let cancelled = false;
    const ensure = () => {
      if (cancelled || !map) return;
      if (map.getSource(SOURCE_ID)) return; // already attached, done
      addLayerOnce();
    };

    ensure(); // attempt synchronously
    map.on("data", ensure); // and on every data tick

    return () => {
      cancelled = true;
      try {
        map.off("data", ensure);
        if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      } catch {
        /* map already torn down */
      }
    };
  }, [map]);

  // ── Effect B: update source data when zones change. The source was
  // initialized with empty features in Effect A; this is the one and
  // only place that pushes real data in.
  useEffect(() => {
    if (!map || !zones) return;
    const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    if (!src) {
      // Race: zones arrived before Effect A's addSource. The next time
      // Effect B fires (zones reference change is a no-op, but a follow-up
      // setData call from Effect B will hit) it'll catch up. Safer:
      // listen once for the source becoming available.
      console.log("[HZ] zones ready but source not yet attached, will retry on sourcedata");
      const onSourceReady = () => {
        const s = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
        if (s && zones) {
          s.setData(toFeatureCollection(zones));
          console.log("[HZ] late setData with", zones.length, "zones");
          map.off("sourcedata", onSourceReady);
        }
      };
      map.on("sourcedata", onSourceReady);
      return () => {
        map.off("sourcedata", onSourceReady);
      };
    }
    src.setData(toFeatureCollection(zones));
    console.log("[HZ] setData with", zones.length, "zones");
  }, [map, zones]);

  // ── Effect C: mirror the enabled state to the layer's visibility.
  // The toggle handler also calls setLayoutProperty inline so the
  // visual change isn't gated on React re-render order, but this
  // effect catches the initial mount + any external toggles.
  useEffect(() => {
    if (!map) return;
    try {
      if (!map.getLayer(LAYER_ID)) return;
      map.setLayoutProperty(
        LAYER_ID,
        "visibility",
        enabled ? "visible" : "none",
      );
    } catch {
      /* layer not yet attached */
    }
  }, [map, enabled]);

  const bottom = TABBAR_HEIGHT + 16 + bottomBoost;

  // Empty-state messaging: only show once we know zones returned empty AND
  // the toggle is on (otherwise the user explicitly hid them). Sits just
  // above the toggle row so it doesn't fight the map.
  const showEmptyState = enabled && zones !== null && zones.length === 0;
  const emptyVariant: "learning" | "filter" = learning?.stillLearning
    ? "learning"
    : "filter";

  return (
    <>
      {showEmptyState && emptyVariant === "learning" && learning && (
        <LearningPanel
          state={learning}
          zonesLearned={0}
          variant="overlay"
          style={{
            position: "absolute",
            left: 12,
            right: 12,
            bottom: bottom + 56,
            zIndex: 11,
            maxWidth: 380,
            margin: "0 auto",
          }}
        />
      )}
      {showEmptyState && emptyVariant === "filter" && (
        <div
          className="ss-mono"
          style={{
            position: "absolute",
            left: 12,
            right: 12,
            bottom: bottom + 56,
            zIndex: 11,
            maxWidth: 380,
            margin: "0 auto",
            padding: "10px 14px",
            borderRadius: 12,
            background: "rgba(11,13,16,0.92)",
            border: `.5px solid ${SS_TOKENS.hairline2}`,
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            color: SS_TOKENS.fg1,
            fontSize: 11,
            letterSpacing: ".04em",
          }}
        >
          No hot zones in your filter — try widening the operator or region.
        </div>
      )}
      <div
        style={{
          position: "absolute",
          left: 12,
          bottom,
          zIndex: 12,
          display: "flex",
          gap: 6,
        }}
      >
        <Tooltip
          side="top"
          align="start"
          content="30-day patrol density heatmap. Brighter areas = more time spent. Tap to hide."
        >
          <button
            type="button"
            onClick={() => {
              const next = !enabled;
              setEnabled(next);
              // Apply visibility directly so the layer flips on the
              // same frame as the click — don't gate on React's
              // re-render → effect mirror cycle.
              if (map) {
                try {
                  if (map.getLayer(LAYER_ID)) {
                    map.setLayoutProperty(
                      LAYER_ID,
                      "visibility",
                      next ? "visible" : "none",
                    );
                  }
                } catch {
                  /* layer not yet attached */
                }
              }
            }}
            aria-pressed={enabled}
            className="ss-mono"
            style={pillStyle(enabled ? SS_TOKENS.alert : SS_TOKENS.fg1)}
          >
            {enabled ? "● HOT ZONES" : "○ HOT ZONES"}
          </button>
        </Tooltip>
        <Tooltip side="top" content="Filter by tail, operator, or region.">
          <button
            type="button"
            onClick={() => setPanelOpen((v) => !v)}
            aria-label="Hot zone filters"
            aria-expanded={panelOpen}
            className="ss-mono"
            style={{
              ...pillStyle(panelOpen ? SS_TOKENS.alert : SS_TOKENS.fg1),
              padding: "8px 10px",
            }}
          >
            {panelOpen ? "▴" : "▾"}
          </button>
        </Tooltip>
      </div>

      {panelOpen && (
        <FilterPanel
          bottom={bottom + 44}
          filter={filter}
          onChange={setFilter}
          onClose={() => setPanelOpen(false)}
        />
      )}
    </>
  );
}

function pillStyle(color: string): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(11,13,16,0.78)",
    border: `.5px solid ${SS_TOKENS.hairline2}`,
    color,
    fontSize: 11,
    letterSpacing: ".06em",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    cursor: "pointer",
    whiteSpace: "nowrap",
    touchAction: "manipulation",
    WebkitTapHighlightColor: "transparent",
  };
}

function toFeatureCollection(
  zones: HotZone[],
): GeoJSON.FeatureCollection<GeoJSON.Point, { count: number }> {
  return {
    type: "FeatureCollection",
    features: zones.map((z) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [z.lon, z.lat] },
      properties: { count: z.count },
    })),
  };
}
