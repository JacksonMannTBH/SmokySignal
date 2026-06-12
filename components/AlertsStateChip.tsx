"use client";

// Tiny mono indicator showing the rider's current push-alerts state.
// Renders only when there's something useful to say — silent on
// unsupported browsers and during the brief load window — and links
// to /settings/alerts so the chip is also the entry point if the
// rider wants to change state.

import { useEffect, useState } from "react";
import Link from "next/link";
import { SS_TOKENS } from "@/lib/tokens";
import { isPushSupported } from "@/lib/push/client";

type State = "loading" | "unsupported" | "denied" | "available" | "armed";

export function AlertsStateChip() {
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    if (!isPushSupported()) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    let cancelled = false;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (!cancelled) setState(sub ? "armed" : "available");
      })
      .catch(() => {
        if (!cancelled) setState("available");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "loading" || state === "unsupported" || state === "armed") {
    return null;
  }

  const denied = state === "denied";
  const color = denied ? SS_TOKENS.warn : SS_TOKENS.fg2;
  const label = denied ? "ALERTS BLOCKED" : "ALERTS OFF";

  return (
    <Link
      href="/settings/alerts"
      className="ss-mono"
      aria-label={`Push alerts: ${label.toLowerCase()}. Tap to manage.`}
      style={{
        fontSize: 9.5,
        letterSpacing: ".08em",
        color,
        textDecoration: "none",
        padding: "2px 6px",
        border: `.5px solid ${SS_TOKENS.hairline2}`,
        borderRadius: 4,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </Link>
  );
}
