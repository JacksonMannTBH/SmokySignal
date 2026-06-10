"use client";

// Visible "Arm alerts" call-to-action for the home page. Self-hides when
// it isn't relevant: armed already, browser blocked, push unsupported,
// or the rider dismissed it within the last 14 days. The settings page
// is one tap away — the CTA exists purely to point riders at it.

import { useEffect, useState } from "react";
import Link from "next/link";
import { SS_TOKENS } from "@/lib/tokens";
import { isPushSupported, getPushPermission } from "@/lib/push/client";

const DISMISS_KEY = "ss_arm_alerts_dismissed_at";
const DISMISS_DAYS = 14;
const DISMISS_MS = DISMISS_DAYS * 24 * 60 * 60 * 1000;

type State =
  | { kind: "loading" }
  | { kind: "unsupported" }
  | { kind: "denied" }
  | { kind: "armed" }
  | { kind: "available"; recentlyDismissed: boolean };

export function ArmAlertsCallout() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (!isPushSupported()) {
      setState({ kind: "unsupported" });
      return;
    }
    if (getPushPermission() === "denied") {
      setState({ kind: "denied" });
      return;
    }
    let cancelled = false;

    // Compute the dismiss-aware "available" state up front and render
    // it IMMEDIATELY. Previously we waited on navigator.serviceWorker
    // .ready before showing anything, which left first-visit riders
    // staring at a missing CTA — verify-prod's 2000ms read-back
    // window beat the 2500ms SW timeout, and even within Playwright
    // the SW often takes 3–5s to register on a cold visit. The CTA
    // is purely a pointer at /settings/alerts; rendering it before
    // we know the rider's subscription state is harmless because the
    // settings page is the source of truth either way.
    //
    // If the SW reveals the rider is actually armed, we hide the CTA
    // afterward (one-tick flicker is acceptable; missing the CTA is
    // not).
    const dismissedAt = Number(
      window.localStorage.getItem(DISMISS_KEY) ?? "0",
    );
    const recentlyDismissed = Date.now() - dismissedAt < DISMISS_MS;
    const availableState: State = { kind: "available", recentlyDismissed };
    setState(availableState);

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (cancelled) return;
        if (sub) setState({ kind: "armed" });
        // else leave availableState in place
      })
      .catch(() => {
        // already showing availableState — nothing to do
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === "loading" || state.kind === "unsupported") return null;
  // Armed state has its own indicator (AlertsStateChip); don't double up.
  if (state.kind === "armed") return null;

  if (state.kind === "denied") {
    return (
      <div
        className="ss-mono"
        style={{
          fontSize: 11,
          color: SS_TOKENS.fg2,
          padding: "8px 12px",
          border: `.5px solid ${SS_TOKENS.hairline}`,
          borderRadius: 8,
          letterSpacing: ".04em",
        }}
      >
        Browser blocked alerts. Open Safari → Settings → Out Of Sight to unblock.
      </div>
    );
  }

  if (state.recentlyDismissed) return null;

  return (
    <div
      style={{
        background: SS_TOKENS.bg1,
        border: `.5px solid ${SS_TOKENS.alert}`,
        borderRadius: 22,
        boxShadow: SS_TOKENS.shadowSm,
        padding: 14,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div className="ss-eyebrow" style={{ marginBottom: 4 }}>
          OPT IN
        </div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: SS_TOKENS.fg0,
            lineHeight: 1.3,
          }}
        >
          Get a ping when Smokey&rsquo;s up.
        </div>
      </div>
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        <Link
          href="/settings/alerts"
          style={{
            background: SS_TOKENS.alert,
            color: "#fffdf8",
            padding: "8px 14px",
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          Arm alerts
        </Link>
        <button
          type="button"
          onClick={() => {
            window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
            setState({ kind: "available", recentlyDismissed: true });
          }}
          aria-label="Dismiss for 14 days"
          style={{
            background: "none",
            border: "none",
            color: SS_TOKENS.fg2,
            fontSize: 12,
            cursor: "pointer",
            padding: "8px 6px",
          }}
        >
          Not now
        </button>
      </div>
    </div>
  );
}
