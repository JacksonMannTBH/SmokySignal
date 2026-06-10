"use client";

import { useEffect, useRef, useState } from "react";
import { SS_TOKENS } from "@/lib/tokens";
import { haversineNm } from "@/lib/geo";
import type { Aircraft } from "@/lib/types";
import { Tooltip } from "./Tooltip";

const STORAGE_KEY = "ss_last_spot";
const RATE_LIMIT_MS = 30_000;
const TABBAR_HEIGHT = 66;
const TOAST_MS = 3500;

// Wrapping localStorage protects us against iOS Safari private-browsing
// where the API throws on every call.
function safeReadLastSpot(): number {
  if (typeof window === "undefined") return 0;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    const n = Number(v ?? 0);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}
function safeWriteLastSpot(ts: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(ts));
  } catch {
    /* private mode — rate limit becomes per-session, that's fine */
  }
}

export function SpottedButton({ airborne }: { airborne: Aircraft[] }) {
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pulsing, setPulsing] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    },
    [],
  );

  const flash = (msg: string, ms = TOAST_MS) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), ms);
  };

  const onTap = async () => {
    if (typeof window === "undefined") return;
    if (busy) return; // single-flight — ignore re-taps while a fix is in flight

    // Immediate visual ack — the user gets feedback in the same frame as
    // the tap, so there's no "did anything happen?" ambiguity even if the
    // geolocation prompt takes a beat.
    setPulsing(true);
    setTimeout(() => setPulsing(false), 200);

    // 1) rate limit
    const last = safeReadLastSpot();
    if (last > 0 && Date.now() - last < RATE_LIMIT_MS) {
      flash("Easy there — wait a bit");
      return;
    }
    // 2) feature check
    if (!navigator.geolocation) {
      flash("Need location to log a spot");
      return;
    }

    setBusy(true);
    flash("Locating…", 8000);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 8000,
        });
      });
      const riderLat = pos.coords.latitude;
      const riderLon = pos.coords.longitude;
      const ts = Date.now();

      const payloadTails = airborne
        .filter((a) => a.lat != null && a.lon != null)
        .map((a) => ({
          tail: a.tail,
          lat: a.lat ?? null,
          lon: a.lon ?? null,
          distance_nm:
            a.lat != null && a.lon != null
              ? haversineNm(riderLat, riderLon, a.lat, a.lon)
              : null,
        }));

      const r = await fetch("/api/spot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: riderLat,
          lon: riderLon,
          ts,
          airborne_tails: payloadTails,
        }),
      });
      if (!r.ok) {
        flash("Spot didn't save");
        return;
      }
      safeWriteLastSpot(ts);
      flash("Spotted, thanks");
    } catch (e) {
      const code = (e as GeolocationPositionError | undefined)?.code;
      if (code === 1 /* PERMISSION_DENIED */) {
        flash("Location denied — enable in Settings to log spots");
      } else if (code === 3 /* TIMEOUT */) {
        flash("Location took too long — try again");
      } else {
        flash("Couldn't get a fix");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Tooltip
        side="left"
        content="Spotted a watcher? Tap to log your location and time. Helps validate the live feed."
      >
        <button
        type="button"
        aria-label="Log a spot of an airborne aircraft"
        aria-busy={busy}
        onClick={onTap}
        style={{
          position: "fixed",
          bottom: TABBAR_HEIGHT + 30,
          right: 16,
          zIndex: 25,
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: `linear-gradient(180deg, ${SS_TOKENS.alert}, ${SS_TOKENS.warn})`,
          color: "#fffdf8",
          border: 0,
          cursor: "pointer",
          // Removes iOS' 300ms double-tap delay and disables browser
          // gestures (pinch zoom) on top of the tap target — the
          // single biggest cause of "tap doesn't respond" on Safari.
          touchAction: "manipulation",
          // Suppresses the iOS gray flash; we have our own scale animation.
          WebkitTapHighlightColor: "transparent",
          opacity: busy ? 0.85 : 1,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 12px 30px rgba(244,196,48,0.34), 0 3px 10px rgba(5,5,5,0.14)",
          transform: pulsing ? "scale(0.9)" : "scale(1)",
          transition: "transform 200ms ease, opacity 200ms ease",
        }}
      >
        <BinocularsIcon />
        </button>
      </Tooltip>
      {toast && (
        <div
          role="status"
          style={{
            position: "fixed",
            left: "50%",
            transform: "translateX(-50%)",
            bottom: TABBAR_HEIGHT + 100,
            zIndex: 26,
            padding: "8px 14px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.92)",
            color: SS_TOKENS.fg0,
            border: `.5px solid ${SS_TOKENS.hairline2}`,
            boxShadow: SS_TOKENS.shadowMd,
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            fontFamily: "inherit",
            fontSize: 11,
            whiteSpace: "nowrap",
          }}
        >
          {toast}
        </div>
      )}
    </>
  );
}

function BinocularsIcon() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 4h3l1 4" />
      <path d="M19 4h-3l-1 4" />
      <path d="M9 8h6" />
      <circle cx="6.5" cy="14.5" r="3.5" />
      <circle cx="17.5" cy="14.5" r="3.5" />
      <path d="M10 14.5h4" />
    </svg>
  );
}
