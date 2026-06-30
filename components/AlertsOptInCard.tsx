"use client";

// Dismissable opt-in card rendered at the bottom of the dashboard variant
// (DashShell) for un-subscribed riders. Shows at most once per browser per
// 14 days (key: ss_alerts_promo_dismissed_at). Tapping "Arm alerts" runs
// subscribePush directly — no extra page navigation.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SS_TOKENS } from "@/lib/tokens";
import {
  getCurrentSubscriptionId,
  isPushSupported,
  pushAvailableInThisContext,
  subscribePush,
} from "@/lib/push/client";

const DISMISS_KEY = "ss_alerts_promo_dismissed_at";
const COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

type Phase = "checking" | "show" | "armed" | "hidden";

export function AlertsOptInCard() {
  const [phase, setPhase] = useState<Phase>("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof window === "undefined") return;
      // Guards: feature support, iOS-PWA context, cooldown, already subscribed.
      if (!isPushSupported() || !pushAvailableInThisContext().available) {
        if (!cancelled) setPhase("hidden");
        return;
      }
      const dismissed = Number(window.localStorage.getItem(DISMISS_KEY) ?? 0);
      if (Number.isFinite(dismissed) && Date.now() - dismissed < COOLDOWN_MS) {
        if (!cancelled) setPhase("hidden");
        return;
      }
      const id = await getCurrentSubscriptionId();
      if (!cancelled) setPhase(id ? "hidden" : "show");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onDismiss = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    }
    setPhase("hidden");
  }, []);

  const onArm = useCallback(async () => {
    setBusy(true);
    setError(null);
    const r = await subscribePush();
    setBusy(false);
    if (r.ok) {
      setPhase("armed");
    } else if (r.reason === "denied") {
      setError("Browser blocked alerts. Update permission in your settings.");
    } else if (r.reason === "vapid_missing") {
      setError("Push isn't configured on this build.");
    } else {
      setError("Couldn't subscribe. Try /settings/alerts.");
    }
  }, []);

  if (phase === "checking" || phase === "hidden") return null;

  if (phase === "armed") {
    return (
      <Wrapper>
        <p
          style={{
            fontSize: 14,
            color: SS_TOKENS.fg0,
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          10-4. Alerts armed. Tweak in{" "}
          <Link
            href="/settings/alerts"
            style={{ color: SS_TOKENS.alert, textDecoration: "underline" }}
          >
            /settings/alerts
          </Link>
          .
        </p>
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      <div
        className="ss-mono"
        style={{
          fontSize: 9.5,
          color: SS_TOKENS.fg2,
          letterSpacing: ".12em",
          marginBottom: 6,
        }}
      >
        OPT IN
      </div>
      <h3
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: SS_TOKENS.fg0,
          margin: 0,
        }}
      >
        Want a ping when Bird&rsquo;s up?
      </h3>
      <p
        style={{
          fontSize: 13,
          color: SS_TOKENS.fg1,
          margin: "8px 0 0",
          lineHeight: 1.45,
        }}
      >
        We&rsquo;ll only ping when an alert-class bird goes up. Tweak later
        in /settings/alerts.
      </p>
      {error && (
        <p
          style={{
            fontSize: 12,
            color: SS_TOKENS.danger,
            margin: "10px 0 0",
            lineHeight: 1.45,
          }}
        >
          {error}
        </p>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button
          type="button"
          onClick={onArm}
          disabled={busy}
          style={{
            padding: "8px 14px",
            borderRadius: 999,
            border: 0,
            background: SS_TOKENS.alert,
            color: "#fffdf8",
            fontFamily: "var(--font-brand)",
            fontSize: 12.5,
            fontWeight: 700,
            letterSpacing: ".02em",
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.6 : 1,
            touchAction: "manipulation",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          Arm alerts
        </button>
        <button
          type="button"
          onClick={onDismiss}
          style={{
            padding: "8px 14px",
            borderRadius: 999,
            border: `.5px solid ${SS_TOKENS.hairline2}`,
            background: "transparent",
            color: SS_TOKENS.fg1,
            fontFamily: "var(--font-brand)",
            fontSize: 12.5,
            fontWeight: 600,
            letterSpacing: ".02em",
            cursor: "pointer",
            touchAction: "manipulation",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          Not now
        </button>
      </div>
    </Wrapper>
  );
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <section
      style={{
        background: SS_TOKENS.bg1,
        border: `.5px solid ${SS_TOKENS.hairline}`,
        borderRadius: 22,
        boxShadow: SS_TOKENS.shadowSm,
        padding: "14px 16px",
      }}
    >
      {children}
    </section>
  );
}
