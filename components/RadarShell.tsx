"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import nextDynamic from "next/dynamic";
import Link from "next/link";
import type { Map as MaplibreMap } from "maplibre-gl";
import { useAircraft } from "@/lib/hooks/useAircraft";
import { SS_TOKENS } from "@/lib/tokens";
import { computeStatus } from "@/lib/status";
import { StatusPill } from "./StatusPill";
import { SpottedButton } from "./SpottedButton";
import { RadarLayerControls } from "./RadarLayerControls";
import { FlightPathLayer } from "./FlightPathLayer";
import { UserZoneLayer } from "./UserZoneLayer";
import { AircraftTrailLayer } from "./AircraftTrailLayer";
import { addUserZone } from "@/lib/user-zones";
import {
  detectProximityHits,
  fireProximityNotifications,
  getProximityThresholdNm,
  isProximityEnabled,
} from "@/lib/proximity-alert";
import { HelpIcon } from "./HelpIcon";
import { Tooltip } from "./Tooltip";
import { FreshnessLabel } from "./FreshnessLabel";
import { RegionSelector } from "./RegionSelector";
import {
  REGION_CHANGE_EVENT,
  getRegion,
  hasExplicitRegion,
  setRegion,
} from "@/lib/region-pref";
import { DEFAULT_REGION, regionForPoint, type RegionId } from "@/lib/regions";
import {
  DEFAULT_RADAR_FILTER,
  RADAR_FILTER_CHANGE_EVENT,
  passesAircraftFilter,
  readRadarFilter,
  type RadarFilter,
} from "@/lib/radar-filter";
import type { Aircraft, FleetEntry, Snapshot } from "@/lib/types";

export type RiderPos = { lat: number; lon: number };

const RadarMap = nextDynamic(() => import("./RadarMap"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: SS_TOKENS.bg0,
      }}
    />
  ),
});

const TABBAR_HEIGHT = 66;
const AIRBORNE_PANEL_EXPANDED_BOOST = 130;
const AIRBORNE_PANEL_COLLAPSED_BOOST = 52;
const AIRBORNE_PANEL_COLLAPSED_KEY = "ss_airborne_panel_collapsed";
const GLASS_BG = "rgba(255,255,255,0.76)";
const GLASS_BG_STRONG = "rgba(255,255,255,0.9)";

type Props = {
  initial: Snapshot;
  mockOn?: boolean;
  /** ms-since-epoch of the most recent track sample. null = unknown. */
  lastSampleMs?: number | null;
};

export function RadarShell({
  initial,
  mockOn = false,
  lastSampleMs = null,
}: Props) {
  const snap = useAircraft(initial, mockOn);
  const fleetMap = useMemo(
    () => new Map<string, FleetEntry>(snap.aircraft.map((a) => [a.tail, a])),
    [snap.aircraft],
  );
  const status = useMemo(() => computeStatus(snap, fleetMap), [snap, fleetMap]);
  // Mirror the heatmap chevron's filter so aircraft markers stay in sync —
  // tapping "Smokey only" should hide non-smokey markers as well as
  // non-smokey heat. Read once on mount and subscribe to the shared
  // change event for cross-component updates.
  const [radarFilter, setRadarFilter] = useState<RadarFilter>(
    DEFAULT_RADAR_FILTER,
  );
  useEffect(() => {
    setRadarFilter(readRadarFilter());
    const onFilterChange = (e: Event) => {
      const detail = (e as CustomEvent<RadarFilter>).detail;
      if (detail) setRadarFilter(detail);
    };
    window.addEventListener(RADAR_FILTER_CHANGE_EVENT, onFilterChange);
    return () => {
      window.removeEventListener(RADAR_FILTER_CHANGE_EVENT, onFilterChange);
    };
  }, []);
  const airborne = useMemo(
    () =>
      snap.aircraft.filter(
        (a) => a.airborne && passesAircraftFilter(a, radarFilter),
      ),
    [snap.aircraft, radarFilter],
  );
  const total = snap.aircraft.length;
  const pillKind = status.kind;
  const pillTooltip =
    status.kind === "alert"
      ? `${status.alertCount} alert-class aircraft up — see /help for the role taxonomy.`
      : status.lead
        ? `Nothing alerting. ${status.lead.entry.nickname ?? status.lead.aircraft.tail} is up but classified ${status.lead.entry.role}.`
        : "Nothing in our 16-tail registry is currently up.";
  const counterColor =
    status.alertCount > 0 ? SS_TOKENS.alert : SS_TOKENS.fg1;

  const [rider, setRider] = useState<RiderPos | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [map, setMap] = useState<MaplibreMap | null>(null);
  const [showRings, setShowRings] = useState(false);
  const [airbornePanelCollapsed, setAirbornePanelCollapsed] = useState(false);
  const [regionId, setRegionId] = useState<RegionId>(DEFAULT_REGION);
  // Hydrate the rings pref + region from localStorage on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setShowRings(window.localStorage.getItem("ss_distance_rings_visible") === "1");
    setAirbornePanelCollapsed(
      window.localStorage.getItem(AIRBORNE_PANEL_COLLAPSED_KEY) === "1",
    );
    setRegionId(getRegion());
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ id: RegionId }>).detail;
      setRegionId(detail?.id ?? getRegion());
    };
    window.addEventListener(REGION_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(REGION_CHANGE_EVENT, onChange);
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      "ss_distance_rings_visible",
      showRings ? "1" : "0",
    );
  }, [showRings]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      AIRBORNE_PANEL_COLLAPSED_KEY,
      airbornePanelCollapsed ? "1" : "0",
    );
  }, [airbornePanelCollapsed]);

  // Foreground proximity alerts. Runs whenever snap.aircraft changes
  // (every poll cycle from useAircraft) — when a tracked alert-tier
  // tail enters the rider's threshold, fire a local notification via
  // the SW. No server-side rider position storage; pure client logic.
  // Per-tail cooldown lives in localStorage to prevent re-firing
  // every 10s while a plane orbits within range.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.visibilityState !== "visible") return;
    if (!rider) return;
    if (!isProximityEnabled()) return;
    const hits = detectProximityHits(
      snap.aircraft,
      rider,
      getProximityThresholdNm(),
    );
    if (hits.length > 0) void fireProximityNotifications(hits);
  }, [snap.aircraft, rider]);

  // Geolocation only kicks in when this component mounts — i.e. when the user
  // actually visits /radar. The home page never asks.
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      flashToast(setToast, "Location off · radar still works");
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setRider({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      () => {
        flashToast(setToast, "Location off · radar still works");
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // First-resolve geolocation auto-pick: if the rider has never picked a
  // region explicitly, auto-pick the bbox-containing region from their
  // position. Returning riders with an explicit pick keep their choice
  // even if a different bbox would otherwise match.
  const didAutoPickRegionRef = useRef(false);
  useEffect(() => {
    if (didAutoPickRegionRef.current) return;
    if (!rider) return;
    if (hasExplicitRegion()) {
      didAutoPickRegionRef.current = true;
      return;
    }
    const picked = regionForPoint(rider.lat, rider.lon);
    if (picked && picked !== regionId) {
      didAutoPickRegionRef.current = true;
      setRegion(picked);
    } else {
      didAutoPickRegionRef.current = true;
    }
  }, [rider, regionId]);

  const airbornePanelBoost =
    airborne.length > 0
      ? airbornePanelCollapsed
        ? AIRBORNE_PANEL_COLLAPSED_BOOST
        : AIRBORNE_PANEL_EXPANDED_BOOST
      : 0;

  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
        paddingBottom: TABBAR_HEIGHT + 18,
        background: SS_TOKENS.bg0,
      }}
    >
      <RadarMap
        aircraft={airborne}
        rider={rider}
        showDistanceRings={showRings}
        regionId={regionId}
        onMapReady={setMap}
      />
      <RadarLayerControls bottomBoost={airbornePanelBoost} />
      <FlightPathLayer map={map} />
      <UserZoneLayer map={map} />
      <AircraftTrailLayer map={map} airborne={airborne} />
      <AddZoneButton
        rider={rider}
        onAdded={(label) => flashToast(setToast, `Zone "${label}" added`)}
      />
      <DistanceRingsToggle
        active={showRings}
        onToggle={() => setShowRings((v) => !v)}
        bottom={`calc(${
          TABBAR_HEIGHT + 16 + airbornePanelBoost
        }px + var(--ss-install-prompt-h, 0px))`}
        disabled={!rider}
      />
      {/* PROMPT_19C diagnostic — sits two rows above the HOT ZONES /
          FLIGHT PATHS pill row (which is at TABBAR_HEIGHT + 16 +
          bottomBoost) and one row above DistanceRingsToggle (+44).
          The calc() adds the iOS install-prompt overlay height so
          the badge stays visible above the prompt on iOS Safari.
          Removed in the follow-up PR once trail rendering is
          confirmed in the wild. */}
      <div
        style={{
          position: "absolute",
          left: 12,
          bottom: `calc(${
            TABBAR_HEIGHT + 16 + airbornePanelBoost + 88
          }px + var(--ss-install-prompt-h, 0px))`,
          zIndex: 12,
        }}
      >
      </div>
      <HelpIcon />

      <header
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          // Right padding 96px reserves room for the fixed wake-lock
          // button (right:12) AND the help icon (right:52) so the
          // airborne counter never tucks under either.
          padding: "12px 96px 12px 16px",
          background: "linear-gradient(180deg, rgba(246,248,246,0.92), rgba(246,248,246,0.54))",
          backdropFilter: "blur(24px) saturate(1.08)",
          WebkitBackdropFilter: "blur(24px) saturate(1.08)",
          borderBottom: `.5px solid ${SS_TOKENS.hairline}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          zIndex: 10,
        }}
      >
        <StatusPill
          kind={pillKind}
          label={status.pill}
          sub={status.pillSub}
          big
          tooltip={pillTooltip}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <RegionSelector />
          <Tooltip
            side="bottom"
            align="end"
            content="How many of our 16 tracked tails are up right now."
          >
            <span
              className="ss-mono"
              tabIndex={0}
              style={{
                fontSize: 10.5,
                color: counterColor,
                letterSpacing: ".06em",
                cursor: "help",
              }}
            >
              {airborne.length}/{total} UP
            </span>
          </Tooltip>
        </div>
      </header>

      <CompassN />

      <div
        style={{
          position: "absolute",
          top: 68,
          left: 12,
          padding: "7px 11px",
          borderRadius: 999,
          background: GLASS_BG,
          border: `.5px solid ${SS_TOKENS.hairline}`,
          boxShadow: SS_TOKENS.shadowSm,
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          zIndex: 10,
        }}
      >
        <FreshnessLabel lastSampleMs={lastSampleMs} />
      </div>

      {airborne.length > 0 && (
        <Carousel
          airborne={airborne}
          collapsed={airbornePanelCollapsed}
          onToggleCollapsed={() => setAirbornePanelCollapsed((v) => !v)}
        />
      )}

      <SpottedButton airborne={airborne} />

      {toast && <Toast message={toast} bottomBoost={airbornePanelBoost} />}
    </main>
  );
}

function flashToast(
  setter: (msg: string | null) => void,
  message: string,
  durationMs = 4000,
) {
  setter(message);
  setTimeout(() => setter(null), durationMs);
}

// "+" floating button — drops a 5nm geofence at the rider's current
// position. Disabled until geolocation resolves so we never save a
// zone at the default Puget Sound centroid by accident. Long-tap is
// intentionally not used here since the radar map below already swallows
// long-press gestures for chevron interactions.
function AddZoneButton({
  rider,
  onAdded,
}: {
  rider: RiderPos | null;
  onAdded: (label: string) => void;
}) {
  const disabled = !rider;
  return (
    <Tooltip side="right" content="Add a 5nm zone at your location">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!rider) return;
          const label =
            window.prompt(
              "Zone label (e.g. Home, Meeting point):",
              "Zone",
            )?.trim() || "Zone";
          const z = addUserZone({
            lat: rider.lat,
            lon: rider.lon,
            radiusNm: 5,
            label,
          });
          onAdded(z.label);
        }}
        aria-label="Add geofence at your location"
        style={{
          position: "absolute",
          top: 52,
          left: 56,
          width: 44,
          height: 44,
          borderRadius: "50%",
          border: `.5px solid ${SS_TOKENS.hairline2}`,
          background: GLASS_BG_STRONG,
          boxShadow: SS_TOKENS.shadowMd,
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          color: disabled ? SS_TOKENS.fg2 : SS_TOKENS.fg0,
          fontSize: 18,
          fontWeight: 700,
          lineHeight: 1,
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
          zIndex: 10,
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        +
      </button>
    </Tooltip>
  );
}

function Toast({
  message,
  bottomBoost,
}: {
  message: string;
  bottomBoost: number;
}) {
  // Sit just above whatever's currently anchored to the bottom — carousel
  // when present, tab bar otherwise.
  const bottomOffset = TABBAR_HEIGHT + 16 + bottomBoost;
  return (
    <div
      role="status"
      style={{
        position: "absolute",
        left: "50%",
        transform: "translateX(-50%)",
        bottom: bottomOffset,
        padding: "8px 14px",
        borderRadius: 999,
        background: GLASS_BG_STRONG,
        border: `.5px solid ${SS_TOKENS.hairline}`,
        boxShadow: SS_TOKENS.shadowMd,
        color: SS_TOKENS.fg2,
        fontFamily: "inherit",
        fontSize: 11,
        zIndex: 20,
        whiteSpace: "nowrap",
      }}
    >
      {message}
    </div>
  );
}

function CompassN() {
  return (
    <Tooltip side="left" content="Map orientation: north is up.">
      <div
        className="ss-mono"
        tabIndex={0}
        aria-label="Map north indicator"
        style={{
          position: "absolute",
          top: 60,
          right: 12,
          width: 34,
          height: 34,
          borderRadius: "50%",
          border: `.5px solid ${SS_TOKENS.hairline2}`,
          background: GLASS_BG_STRONG,
          boxShadow: SS_TOKENS.shadowMd,
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          fontWeight: 700,
          color: SS_TOKENS.fg1,
          zIndex: 10,
          cursor: "help",
        }}
      >
        N
      </div>
    </Tooltip>
  );
}

function Carousel({
  airborne,
  collapsed,
  onToggleCollapsed,
}: {
  airborne: Aircraft[];
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  if (collapsed) {
    return (
      <Tooltip side="top" align="start" content="Show airborne aircraft cards">
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-expanded={false}
          aria-label="Show airborne aircraft cards"
          className="ss-mono"
          style={{
            position: "absolute",
            left: 12,
            bottom: `calc(${TABBAR_HEIGHT + 16}px + var(--ss-install-prompt-h, 0px))`,
            zIndex: 14,
            width: 56,
            height: 56,
            borderRadius: "50%",
            border: `.5px solid ${SS_TOKENS.hairline2}`,
            background: "rgba(255,255,255,0.92)",
            color: SS_TOKENS.alert,
            boxShadow: SS_TOKENS.shadowMd,
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            cursor: "pointer",
            display: "inline-flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 1,
            touchAction: "manipulation",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <span style={{ fontSize: 17, fontWeight: 800, lineHeight: 1 }}>
            {airborne.length}
          </span>
          <span style={{ fontSize: 9, fontWeight: 800, lineHeight: 1 }}>
            UP
          </span>
        </button>
      </Tooltip>
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: TABBAR_HEIGHT,
        padding: collapsed ? "10px 14px 12px" : "14px 14px 18px",
        background: "rgba(255,255,255,0.88)",
        borderTop: `.5px solid ${SS_TOKENS.hairline}`,
        borderRadius: "18px 18px 0 0",
        boxShadow: SS_TOKENS.shadowLg,
        backdropFilter: "blur(24px) saturate(1.12)",
        WebkitBackdropFilter: "blur(24px) saturate(1.12)",
        zIndex: 10,
      }}
    >
      <div
        className="ss-eyebrow"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: collapsed ? 0 : 10,
          paddingLeft: 2,
          color: SS_TOKENS.fg1,
        }}
      >
        Up right now · tap to track
        <Tooltip
          side="top"
          align="end"
          content={collapsed ? "Show airborne cards" : "Collapse airborne cards"}
        >
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-expanded={!collapsed}
            aria-label={
              collapsed
                ? "Show airborne aircraft cards"
                : "Collapse airborne aircraft cards"
            }
            className="ss-mono"
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              border: `.5px solid ${SS_TOKENS.hairline2}`,
              background: "rgba(255,255,255,0.92)",
              color: SS_TOKENS.fg1,
              boxShadow: SS_TOKENS.shadowSm,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 0,
              fontWeight: 800,
              lineHeight: 1,
              touchAction: "manipulation",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <span style={{ fontSize: 16 }}>v</span>
            {collapsed ? "⌃" : "⌄"}
          </button>
        </Tooltip>
      </div>
      {!collapsed && (
        <div
          className="ss-scroll"
          style={{
            display: "flex",
            gap: 10,
            overflowX: "auto",
            // Allow cards to bleed into right edge; iOS smooth scroll.
            WebkitOverflowScrolling: "touch",
          }}
        >
          {airborne.map((p) => (
            <PlaneCard key={p.tail} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function PlaneCard({ p }: { p: Aircraft }) {
  return (
    <Link
      href={`/plane/${p.tail}`}
      prefetch={false}
      style={{
        flex: "0 0 auto",
        minWidth: 200,
        padding: 14,
        borderRadius: 20,
        background: "rgba(255,255,255,0.94)",
        border: `.5px solid ${SS_TOKENS.hairline}`,
        boxShadow: SS_TOKENS.shadowSm,
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: SS_TOKENS.alert,
            animation: "ss-blink 1.6s infinite",
          }}
        />
        <span
          className="ss-mono"
          style={{ fontSize: 13, fontWeight: 600, color: SS_TOKENS.fg0 }}
        >
          {p.tail}
        </span>
        {p.nickname && (
          <span style={{ fontSize: 11, color: SS_TOKENS.fg1 }}>
            &ldquo;{p.nickname}&rdquo;
          </span>
        )}
      </div>
      <div style={{ fontSize: 11, color: SS_TOKENS.fg2, marginTop: 5 }}>
        {p.operator}
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
        <Stat
          label="ALT"
          value={
            p.altitude_ft != null
              ? `${p.altitude_ft.toLocaleString()}′`
              : "—"
          }
        />
        <Stat
          label="GS"
          value={p.ground_speed_kt != null ? `${p.ground_speed_kt}kt` : "—"}
        />
        <Stat
          label="TIME"
          value={p.time_aloft_min != null ? `${p.time_aloft_min}m` : "—"}
        />
      </div>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        className="ss-mono"
        style={{
          fontSize: 9.5,
          color: SS_TOKENS.fg2,
          letterSpacing: ".08em",
        }}
      >
        {label}
      </div>
      <div
        className="ss-mono"
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: SS_TOKENS.fg0,
          marginTop: 1,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function DistanceRingsToggle({
  active,
  onToggle,
  bottom,
  disabled,
}: {
  active: boolean;
  onToggle: () => void;
  bottom: number | string;
  disabled?: boolean;
}) {
  // Sit just above the hot-zones toggle row so it doesn't compete for the
  // same horizontal space. Also disabled when there's no rider position to
  // pin the rings to — the toggle stays visible (so the user knows the
  // feature exists) but greys out.
  return (
    <Tooltip
      side="top"
      align="start"
      content={
        disabled
          ? "Distance rings need your location. Allow location access on /radar."
          : "5 / 10 / 15 nm rings around your position. Tap to toggle."
      }
    >
      <button
        type="button"
        onClick={() => {
          if (!disabled) onToggle();
        }}
        aria-pressed={active}
        aria-disabled={disabled}
        className="ss-mono"
        style={{
          position: "absolute",
          left: 12,
          bottom:
            typeof bottom === "number"
              ? bottom + 44
              : `calc(${bottom} + 44px)`,
          zIndex: 12,
          padding: "9px 13px",
          borderRadius: 999,
          background: GLASS_BG_STRONG,
          border: `.5px solid ${SS_TOKENS.hairline2}`,
          color: disabled
            ? SS_TOKENS.fg3
            : active
              ? SS_TOKENS.alert
              : SS_TOKENS.fg1,
          fontSize: 11,
          letterSpacing: 0,
          boxShadow: SS_TOKENS.shadowMd,
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          cursor: disabled ? "not-allowed" : "pointer",
          whiteSpace: "nowrap",
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        {active ? "Rings on" : "Rings"}
      </button>
    </Tooltip>
  );
}
