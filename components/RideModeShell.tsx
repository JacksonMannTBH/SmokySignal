"use client";

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { useRouter } from "next/navigation";
import { useAircraft } from "@/lib/hooks/useAircraft";
import { useRiderPos } from "@/lib/hooks/useRiderPos";
import { useDeviceHeading } from "@/lib/hooks/useDeviceHeading";
import {
  classifyRideStatus,
  getRideContacts,
  rideStatusSeverity,
  type RideContact,
  type RideStatus,
} from "@/lib/ride-mode";
import type { Snapshot } from "@/lib/types";
import { RideCompass } from "./RideCompass";

type Props = {
  initial: Snapshot;
  mockOn?: boolean;
};

type WakeLockSentinel = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener?: (type: string, listener: () => void) => void;
};

type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> };
};

type ServiceWorkerNotificationOptions = NotificationOptions & {
  renotify?: boolean;
};

const STATUS_COLORS: Record<RideStatus, string> = {
  clear: "#39d98a",
  watch: "#60a5fa",
  warning: "#f4c430",
  danger: "#ff4d4f",
};

const STALE_WARN_MS = 45_000;
const STALE_DANGER_MS = 90_000;
const NOTIFY_COOLDOWN_MS = 90_000;

export function RideModeShell({ initial, mockOn = false }: Props) {
  const router = useRouter();
  const snap = useAircraft(initial, mockOn);
  const { pos, unavailable } = useRiderPos();
  const heading = useDeviceHeading(pos?.heading);
  const [now, setNow] = useState(initial.fetched_at);
  const notifyRef = useRef<{
    status: RideStatus;
    tail: string | null;
    distanceNm: number | null;
    ts: number;
  } | null>(null);

  useRideChrome();
  useRideWakeLock();

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const contacts = useMemo<RideContact[]>(() => {
    if (!pos) return [];
    return getRideContacts(snap.aircraft, pos, heading.headingDeg, true);
  }, [snap.aircraft, pos, heading.headingDeg]);

  const nearest = contacts[0] ?? null;
  const status = classifyRideStatus(nearest?.distanceNm ?? null);
  const statusColor = STATUS_COLORS[status];
  const modeLabel = heading.headingDeg == null ? "North-up" : "Relative";
  const displayBearing =
    nearest == null
      ? null
      : nearest.relativeBearingDeg == null
        ? nearest.bearingDeg
        : nearest.relativeBearingDeg;
  const lastUpdateAgeMs = Math.max(0, now - snap.fetched_at);
  const staleLevel =
    lastUpdateAgeMs >= STALE_DANGER_MS
      ? "stale"
      : lastUpdateAgeMs >= STALE_WARN_MS
        ? "lagging"
        : "fresh";

  useRideNotifications(status, nearest, notifyRef);

  const aircraftName = nearest
    ? nearest.plane.nickname ?? nearest.plane.tail
    : null;
  const withinFive = nearest != null && nearest.distanceNm <= 5;
  const primaryCopy = !pos
    ? unavailable
      ? "Location unavailable"
      : "Waiting for rider location"
    : withinFive && nearest
      ? `${aircraftName}: ${nearest.distanceNm.toFixed(1)} nm ${nearest.cardinal}`
      : "No watched aircraft within 5 nm";
  const secondaryCopy = nearest
    ? `Nearest watched aircraft: ${nearest.distanceNm.toFixed(1)} nm ${nearest.cardinal}`
    : pos
      ? "No watched aircraft within 5 nm"
      : "Distances show in nm once GPS resolves";

  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        minHeight: "100dvh",
        padding:
          "max(18px, env(safe-area-inset-top)) 18px max(18px, env(safe-area-inset-bottom))",
        background:
          status === "danger"
            ? "radial-gradient(circle at 50% 20%, rgba(255,77,79,.24), transparent 32%), #020202"
            : "radial-gradient(circle at 50% 18%, rgba(244,196,48,.10), transparent 34%), #020202",
        color: "#f5f2e8",
        display: "grid",
        gridTemplateRows: "auto 1fr auto",
        overflow: "hidden",
      }}
    >
      <header
        style={{
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          paddingTop: 6,
        }}
      >
        <div
          aria-live="polite"
          style={{
            color: statusColor,
            fontSize: "clamp(56px, 17vw, 112px)",
            lineHeight: 0.92,
            fontWeight: 950,
            letterSpacing: 0,
            textShadow:
              status === "danger"
                ? "0 0 26px rgba(255,77,79,.48)"
                : `0 0 18px color-mix(in srgb, ${statusColor} 24%, transparent)`,
          }}
        >
          {status.toUpperCase()}
        </div>
        <div
          style={{
            color: "#f5f2e8",
            fontSize: "clamp(18px, 5vw, 28px)",
            lineHeight: 1.12,
            fontWeight: 850,
            maxWidth: 420,
          }}
        >
          {primaryCopy}
        </div>
        <div
          style={{
            color: staleLevel === "fresh" ? "#a9a28a" : "#f4c430",
            fontSize: 13,
            fontWeight: 800,
          }}
        >
          Last update: {formatAge(lastUpdateAgeMs)}
          {staleLevel === "stale" ? " - DATA STALE" : ""}
        </div>
      </header>

      <div
        style={{
          display: "grid",
          placeItems: "center",
          minHeight: 0,
        }}
      >
        <RideCompass
          status={status}
          contact={nearest}
          displayBearingDeg={displayBearing}
          modeLabel={modeLabel}
        />
      </div>

      <footer
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          paddingBottom: 2,
        }}
      >
        <div
          style={{
            width: "min(100%, 460px)",
            padding: "12px 14px",
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.06)",
            textAlign: "center",
            boxShadow: "0 16px 50px rgba(0,0,0,0.28)",
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 900, lineHeight: 1.2 }}>
            {secondaryCopy}
          </div>
          <div
            style={{
              marginTop: 5,
              color: "#a9a28a",
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            {modeLabel} - ADS-B awareness only
          </div>
        </div>
        <button
          type="button"
          onClick={() => router.push("/")}
          aria-label="End Ride and return to the main app"
          style={{
            width: "min(100%, 460px)",
            minHeight: 56,
            borderRadius: 18,
            border: "1px solid #ffffff",
            background: "#ffffff",
            color: "#050505",
            fontFamily: "inherit",
            fontSize: 18,
            fontWeight: 900,
            cursor: "pointer",
            touchAction: "manipulation",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          End Ride
        </button>
      </footer>
    </main>
  );
}

function useRideChrome() {
  useEffect(() => {
    document.body.dataset.rideMode = "true";
    return () => {
      delete document.body.dataset.rideMode;
    };
  }, []);
}

function useRideWakeLock() {
  useEffect(() => {
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;
    const nav = navigator as WakeLockNavigator;

    const release = async () => {
      const current = sentinel;
      sentinel = null;
      if (current && !current.released) {
        try {
          await current.release();
        } catch {
          /* already released */
        }
      }
    };

    const acquire = async () => {
      if (!nav.wakeLock || document.visibilityState !== "visible") return;
      try {
        sentinel = await nav.wakeLock.request("screen");
        sentinel.addEventListener?.("release", () => {
          sentinel = null;
        });
      } catch {
        sentinel = null;
      }
    };

    void acquire();
    const onVisibility = () => {
      if (document.visibilityState === "visible" && !sentinel && !cancelled) {
        void acquire();
      } else if (document.visibilityState === "hidden") {
        void release();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void release();
    };
  }, []);
}

function useRideNotifications(
  status: RideStatus,
  nearest: RideContact | null,
  ref: MutableRefObject<{
    status: RideStatus;
    tail: string | null;
    distanceNm: number | null;
    ts: number;
  } | null>,
) {
  useEffect(() => {
    const now = Date.now();
    const tail = nearest?.plane.tail ?? null;
    const distanceNm = nearest?.distanceNm ?? null;
    const prev = ref.current;
    if (!prev) {
      ref.current = { status, tail, distanceNm, ts: now };
      return;
    }

    const cooldownMet = now - prev.ts >= NOTIFY_COOLDOWN_MS;
    const severity = rideStatusSeverity(status);
    const prevSeverity = rideStatusSeverity(prev.status);
    const severityChanged = severity !== prevSeverity;
    const tailChanged = severity > 0 && tail != null && tail !== prev.tail;
    const distanceChanged =
      severity >= 2 &&
      distanceNm != null &&
      prev.distanceNm != null &&
      Math.abs(distanceNm - prev.distanceNm) >= 0.5;

    if (
      cooldownMet &&
      (severityChanged || tailChanged || distanceChanged) &&
      (severity > 0 || prevSeverity > 0)
    ) {
      void postRideNotification(status, nearest);
      ref.current = { status, tail, distanceNm, ts: now };
      return;
    }

    ref.current = { status, tail, distanceNm, ts: prev.ts };
  }, [nearest, ref, status]);
}

async function postRideNotification(
  status: RideStatus,
  nearest: RideContact | null,
) {
  if (typeof window === "undefined") return;
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return;

  const label = status.toUpperCase();
  const title =
    status === "clear" || !nearest
      ? "Clear - No watched aircraft within 5 nm"
      : `${label} - ${nearest.plane.nickname ?? nearest.plane.tail} ${nearest.distanceNm.toFixed(1)} nm ${nearest.cardinal}`;
  const options: ServiceWorkerNotificationOptions = {
    body: "ADS-B awareness only.",
    icon: "/icons/washington-eye-logo.svg",
    badge: "/icons/favicon.svg",
    tag: "ride-mode-status",
    renotify: status === "warning" || status === "danger",
    data: { url: "/ride", kind: "ride-mode", status },
  };
  try {
    await reg.showNotification(title, options);
  } catch {
    /* best-effort */
  }
}

function formatAge(ageMs: number): string {
  const seconds = Math.max(0, Math.floor(ageMs / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}
