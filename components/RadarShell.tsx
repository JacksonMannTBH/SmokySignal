"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import nextDynamic from "next/dynamic";
import Link from "next/link";
import type { Map as MaplibreMap } from "maplibre-gl";
import { useAircraft } from "@/lib/hooks/useAircraft";
import { SS_TOKENS } from "@/lib/tokens";
import {
  THEME_CHANGE_EVENT,
  THEME_STORAGE_KEY,
  readStoredDarkTheme,
} from "@/lib/theme";
import { computeStatus } from "@/lib/status";
import { StatusPill } from "./StatusPill";
import { RadarLayerControls } from "./RadarLayerControls";
import { FlightPathLayer } from "./FlightPathLayer";
import { UserZoneLayer } from "./UserZoneLayer";
import { AircraftTrailLayer } from "./AircraftTrailLayer";
import { aircraftColorForTail } from "@/lib/aircraft-colors";
import {
  detectProximityHits,
  fireProximityNotifications,
  getProximityThresholdNm,
  isProximityEnabled,
} from "@/lib/proximity-alert";
import { Tooltip } from "./Tooltip";
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
const AIRBORNE_BUBBLE_BOOST = 66;
const GLASS_BG_STRONG = SS_TOKENS.surface;

type Props = {
  initial: Snapshot;
  mockOn?: boolean;
};

export function RadarShell({
  initial,
  mockOn = false,
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
  const pillKind = status.kind;
  const pillTooltip =
    status.kind === "alert"
      ? `${status.alertCount} alert-class aircraft up.`
      : status.lead
        ? `Nothing alerting. ${status.lead.entry.nickname ?? status.lead.aircraft.tail} is up but classified ${status.lead.entry.role}.`
        : "Nothing in our 16-tail registry is currently up.";

  const [rider, setRider] = useState<RiderPos | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [map, setMap] = useState<MaplibreMap | null>(null);
  const [showRings, setShowRings] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [regionId, setRegionId] = useState<RegionId>(DEFAULT_REGION);
  // Hydrate the rings pref + region from localStorage on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setShowRings(window.localStorage.getItem("ss_distance_rings_visible") === "1");
    setDarkMode(readStoredDarkTheme());
    setRegionId(getRegion());
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ id: RegionId }>).detail;
      setRegionId(detail?.id ?? getRegion());
    };
    const onThemeChange = (e: Event) => {
      const detail = (e as CustomEvent<{ dark?: boolean }>).detail;
      setDarkMode(detail?.dark ?? readStoredDarkTheme());
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY) {
        setDarkMode(readStoredDarkTheme());
      }
    };
    window.addEventListener(REGION_CHANGE_EVENT, onChange);
    window.addEventListener(THEME_CHANGE_EVENT, onThemeChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(REGION_CHANGE_EVENT, onChange);
      window.removeEventListener(THEME_CHANGE_EVENT, onThemeChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      "ss_distance_rings_visible",
      showRings ? "1" : "0",
    );
  }, [showRings]);
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

  const airbornePanelBoost = airborne.length > 0 ? AIRBORNE_BUBBLE_BOOST : 0;

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
        darkMode={darkMode}
        regionId={regionId}
        onMapReady={setMap}
      />
      <RadarLayerControls bottomBoost={airbornePanelBoost} />
      <FlightPathLayer map={map} />
      <UserZoneLayer map={map} />
      <AircraftTrailLayer map={map} airborne={airborne} />
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

      <header
        style={{
          position: "absolute",
          left: 10,
          top: "calc(env(safe-area-inset-top, 0px) + 58px)",
          padding: 0,
          background: "transparent",
          display: "flex",
          alignItems: "center",
          gap: 8,
          zIndex: 16,
        }}
      >
        <StatusPill
          kind={pillKind}
          label={status.pill}
          sub={status.pillSub}
          big
          tooltip={pillTooltip}
        />
      </header>

      <CompassN />

      {airborne.length > 0 && (
        <AirborneBubbles airborne={airborne} />
      )}

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
          top: "calc(env(safe-area-inset-top, 0px) + 128px)",
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

function AirborneBubbles({ airborne }: { airborne: Aircraft[] }) {
  return (
    <nav
      aria-label="Airborne aircraft"
      className="ss-scroll"
      style={{
        position: "absolute",
        left: 12,
        right: 84,
        bottom: `calc(${TABBAR_HEIGHT + 12}px + var(--ss-install-prompt-h, 0px))`,
        zIndex: 14,
        display: "flex",
        justifyContent: "center",
        gap: 8,
        overflowX: "auto",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {airborne.map((p) => {
        const color = aircraftColorForTail(p.tail);
        return (
          <Tooltip
            key={p.tail}
            side="top"
            content={`${p.nickname ?? p.tail} - ${p.operator}`}
          >
            <Link
              href={`/plane/${p.tail}`}
              prefetch={false}
              aria-label={`View ${p.nickname ?? p.tail} details`}
              className="ss-mono"
              style={{
                flex: "0 0 auto",
                width: 58,
                height: 58,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.94)",
                border: `1.5px solid ${color}`,
                boxShadow: SS_TOKENS.shadowMd,
                color: SS_TOKENS.fg0,
                textDecoration: "none",
                display: "inline-flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                fontSize: 9.5,
                fontWeight: 800,
                lineHeight: 1,
                touchAction: "manipulation",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: color,
                  boxShadow: `0 0 0 4px ${color}22`,
                  animation: "ss-blink 1.6s infinite",
                }}
              />
              <span>{p.tail}</span>
              {p.ground_speed_kt != null && (
                <span style={{ color: SS_TOKENS.fg2, fontSize: 8.5 }}>
                  {p.ground_speed_kt}kt
                </span>
              )}
            </Link>
          </Tooltip>
        );
      })}
    </nav>
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
        Airborne
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

