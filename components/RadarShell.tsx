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
import { HotZoneLayer } from "./HotZoneLayer";
import { FlightPathLayer } from "./FlightPathLayer";
import { UserZoneLayer } from "./UserZoneLayer";
import { AircraftTrailLayer } from "./AircraftTrailLayer";
import { TrailStatusBadge } from "./TrailStatusBadge";
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
import type { LearningState } from "@/lib/learning";

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

type Props = {
  initial: Snapshot;
  mockOn?: boolean;
  learning?: LearningState;
  /** ms-since-epoch of the most recent track sample. null = unknown. */
  lastSampleMs?: number | null;
};

export function RadarShell({
  initial,
  mockOn = false,
  learning,
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
  const [regionId, setRegionId] = useState<RegionId>(DEFAULT_REGION);
  // Hydrate the rings pref + region from localStorage on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setShowRings(window.localStorage.getItem("ss_distance_rings_visible") === "1");
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

  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
        paddingBottom: TABBAR_HEIGHT,
      }}
    >
      <RadarMap
        aircraft={airborne}
        rider={rider}
        showDistanceRings={showRings}
        regionId={regionId}
        onMapReady={setMap}
      />
      <HotZoneLayer
        map={map}
        bottomBoost={airborne.length > 0 ? 130 : 0}
        learning={learning}
      />
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
        bottom={
          TABBAR_HEIGHT + 16 + (airborne.length > 0 ? 130 : 0)
        }
        disabled={!rider}
      />
      {/* PROMPT_19C diagnostic — sits two rows above the HOT ZONES /
          FLIGHT PATHS pill row (which is at TABBAR_HEIGHT + 16 +
          bottomBoost) and one row above DistanceRingsToggle (+44).
          Removed in the follow-up PR once trail rendering is
          confirmed in the wild. */}
      <div
        style={{
          position: "absolute",
          left: 12,
          bottom: TABBAR_HEIGHT + 16 + (airborne.length > 0 ? 130 : 0) + 88,
          zIndex: 12,
        }}
      >
        <TrailStatusBadge airborne={airborne} />
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
          background: "rgba(11,13,16,.7)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
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
          top: 60,
          left: 12,
          padding: "4px 8px",
          borderRadius: 6,
          background: "rgba(11,13,16,0.7)",
          border: `.5px solid ${SS_TOKENS.hairline}`,
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          zIndex: 10,
        }}
      >
        <FreshnessLabel lastSampleMs={lastSampleMs} />
      </div>

      {airborne.length > 0 && <Carousel airborne={airborne} />}

      <SpottedButton airborne={airborne} />

      {toast && <Toast message={toast} hasCarousel={airborne.length > 0} />}
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
          background: "rgba(11,13,16,.7)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
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
  hasCarousel,
}: {
  message: string;
  hasCarousel: boolean;
}) {
  // Sit just above whatever's currently anchored to the bottom — carousel
  // when present, tab bar otherwise.
  const bottomOffset = hasCarousel ? TABBAR_HEIGHT + 130 : TABBAR_HEIGHT + 16;
  return (
    <div
      role="status"
      style={{
        position: "absolute",
        left: "50%",
        transform: "translateX(-50%)",
        bottom: bottomOffset,
        padding: "8px 14px",
        borderRadius: 8,
        background: SS_TOKENS.bg2,
        border: `.5px solid ${SS_TOKENS.hairline}`,
        color: SS_TOKENS.fg2,
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        letterSpacing: ".04em",
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
          width: 28,
          height: 28,
          borderRadius: "50%",
          border: `.5px solid ${SS_TOKENS.hairline2}`,
          background: "rgba(11,13,16,.7)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10,
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

function Carousel({ airborne }: { airborne: Aircraft[] }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: TABBAR_HEIGHT,
        padding: "8px 16px 12px",
        background:
          "linear-gradient(to top, rgba(11,13,16,.92) 60%, rgba(11,13,16,0))",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        zIndex: 10,
      }}
    >
      <div
        className="ss-eyebrow"
        style={{ marginBottom: 8, paddingLeft: 2 }}
      >
        Up right now · tap to track
      </div>
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
        padding: 12,
        borderRadius: 12,
        background: SS_TOKENS.bg1,
        border: `.5px solid ${SS_TOKENS.hairline}`,
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
  bottom: number;
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
          bottom: bottom + 44,
          zIndex: 12,
          padding: "8px 12px",
          borderRadius: 999,
          background: "rgba(11,13,16,0.78)",
          border: `.5px solid ${SS_TOKENS.hairline2}`,
          color: disabled
            ? SS_TOKENS.fg3
            : active
              ? SS_TOKENS.alert
              : SS_TOKENS.fg1,
          fontSize: 11,
          letterSpacing: ".06em",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          cursor: disabled ? "not-allowed" : "pointer",
          whiteSpace: "nowrap",
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        {active ? "● RINGS" : "○ RINGS"}
      </button>
    </Tooltip>
  );
}
