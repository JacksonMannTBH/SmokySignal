"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SS_TOKENS } from "@/lib/tokens";
import {
  getCurrentSubscriptionId,
  getPushPermission,
  isPushSupported,
  pushAvailableInThisContext,
  showLocalTestNotification,
  subscribePush,
  unsubscribePush,
  updatePushPrefs,
} from "@/lib/push/client";
import { DEFAULT_PREFS, type AlertPrefs } from "@/lib/push/types";
import {
  DEFAULT_PROXIMITY_NM,
  getProximityThresholdNm,
  isProximityEnabled,
  setProximityEnabled,
  setProximityThresholdNm,
} from "@/lib/proximity-alert";
import { TRACKED_TAILS } from "@/lib/tracked-tails";

type LoadState = "loading" | "ready";

export function AlertsSettings() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [supported, setSupported] = useState(true);
  const [contextOk, setContextOk] = useState<{
    available: boolean;
    reason?: "ios-not-pwa" | "ios-too-old";
  }>({ available: true });
  const [permission, setPermission] =
    useState<NotificationPermission>("default");
  const [subId, setSubId] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<AlertPrefs>(DEFAULT_PREFS);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [proximityOn, setProximityOn] = useState<boolean>(false);
  const [proximityNm, setProximityNm] = useState<number>(DEFAULT_PROXIMITY_NM);

  useEffect(() => {
    setProximityOn(isProximityEnabled());
    setProximityNm(getProximityThresholdNm());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sup = isPushSupported();
      setSupported(sup);
      setContextOk(pushAvailableInThisContext());
      setPermission(getPushPermission());
      if (sup) {
        const id = await getCurrentSubscriptionId();
        if (!cancelled && id) setSubId(id);
      }
      if (!cancelled) setLoadState("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }, []);

  const fixedPrefs = useMemo<AlertPrefs>(
    () => ({
      ...prefs,
      tier: "all",
      zones: "any",
      tails: undefined,
      userZones: undefined,
    }),
    [prefs],
  );

  const onArm = useCallback(async () => {
    setBusy(true);
    const r = await subscribePush(fixedPrefs);
    setBusy(false);
    setPermission(getPushPermission());
    if (r.ok) {
      setSubId(r.id);
      flash("10-4. We'll keep you posted.");
    } else if (r.reason === "denied") {
      flash("Browser blocked alerts. Update permission in your settings.");
    } else if (r.reason === "vapid_missing") {
      flash("Push isn't configured on this build. Try the live site.");
    } else if (r.reason === "unsupported") {
      flash("This browser doesn't support push.");
    } else {
      flash("Couldn't subscribe. Try again in a moment.");
    }
  }, [fixedPrefs, flash]);

  const onDisarm = useCallback(async () => {
    setBusy(true);
    await unsubscribePush();
    setBusy(false);
    setSubId(null);
    flash("Off the air. Channel 19 still open if you change your mind.");
  }, [flash]);

  const persistPrefs = useCallback(
    async (next: Partial<AlertPrefs>) => {
      const merged: AlertPrefs = { ...prefs, ...next };
      setPrefs(merged);
      if (!subId) return;
      const ok = await updatePushPrefs(subId, next);
      if (!ok) flash("Couldn't save preference. Try again.");
    },
    [prefs, subId, flash],
  );

  const onTest = useCallback(async () => {
    if (permission !== "granted") {
      flash("Arm alerts first to receive the test ping.");
      return;
    }
    const ok = await showLocalTestNotification();
    if (!ok) flash("Couldn't send the test ping.");
  }, [permission, flash]);

  const statusBadge = useMemo<{ label: string; color: string; bg: string }>(
    () =>
      subId
        ? { label: "ARMED", color: SS_TOKENS.alert, bg: SS_TOKENS.alertDim }
        : { label: "OFF", color: SS_TOKENS.fg2, bg: SS_TOKENS.bg2 },
    [subId],
  );

  return (
    <main
      style={{
        minHeight: "100dvh",
        padding: "12px 18px 180px",
        maxWidth: 460,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginTop: 4,
        }}
      >
        <span className="ss-eyebrow">Alerts - Channel 19</span>
        <Link
          href="/"
          className="ss-mono"
          style={{
            fontSize: 11,
            color: SS_TOKENS.fg1,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            minHeight: 44,
            padding: "0 8px",
            margin: "-12px -8px",
          }}
        >
          Back
        </Link>
      </header>

      <h1
        style={{
          fontSize: 28,
          fontWeight: 800,
          letterSpacing: 0,
          lineHeight: 1.1,
          color: SS_TOKENS.fg0,
          margin: 0,
        }}
      >
        Get a ping when the bird's up.
      </h1>

      {loadState === "loading" ? (
        <Card>
          <p style={{ color: SS_TOKENS.fg2, fontSize: 13 }}>Checking...</p>
        </Card>
      ) : !supported ? (
        <UnsupportedCard />
      ) : !contextOk.available ? (
        <IosNotPwaCard reason={contextOk.reason} />
      ) : (
        <>
          <Card>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div>
                <div
                  className="ss-mono"
                  style={{
                    fontSize: 9.5,
                    letterSpacing: 0,
                    color: SS_TOKENS.fg2,
                  }}
                >
                  STATUS
                </div>
                <div
                  className="ss-mono"
                  style={{
                    display: "inline-block",
                    marginTop: 6,
                    padding: "3px 10px",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 0,
                    color: statusBadge.color,
                    background: statusBadge.bg,
                    border: `.5px solid ${statusBadge.color}55`,
                  }}
                >
                  {statusBadge.label}
                </div>
                {!subId && (
                  <p
                    style={{
                      marginTop: 10,
                      fontSize: 13,
                      color: SS_TOKENS.fg2,
                      lineHeight: 1.45,
                    }}
                  >
                    Alerts are off. Arm once to follow the fixed aircraft list.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={subId ? onDisarm : onArm}
                disabled={busy || permission === "denied"}
                style={{
                  padding: "10px 16px",
                  borderRadius: 999,
                  border: 0,
                  background: subId ? SS_TOKENS.bg2 : SS_TOKENS.alert,
                  color: subId ? SS_TOKENS.fg1 : SS_TOKENS.bg0,
                  fontFamily: "var(--font-brand)",
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: 0,
                  cursor:
                    busy || permission === "denied" ? "default" : "pointer",
                  opacity: busy || permission === "denied" ? 0.6 : 1,
                  touchAction: "manipulation",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                {subId ? "Disarm" : "Arm alerts"}
              </button>
            </div>

            {permission === "denied" && (
              <p
                style={{
                  marginTop: 12,
                  fontSize: 12.5,
                  color: SS_TOKENS.danger,
                  lineHeight: 1.45,
                }}
              >
                Your browser blocked alerts. Open Safari settings for Out Of
                Sight to fix.
              </p>
            )}
          </Card>

          <Section eyebrow="Tracked aircraft">
            <p
              style={{
                fontSize: 13,
                color: SS_TOKENS.fg1,
                margin: 0,
                lineHeight: 1.45,
              }}
            >
              Alerts use this fixed list for everyone.
            </p>
            <div
              className="ss-mono"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(72px, 1fr))",
                gap: 6,
              }}
            >
              {TRACKED_TAILS.map((tail) => (
                <span
                  key={tail}
                  style={{
                    padding: "7px 8px",
                    borderRadius: 8,
                    background: SS_TOKENS.bg2,
                    border: `.5px solid ${SS_TOKENS.hairline2}`,
                    color: SS_TOKENS.fg0,
                    fontSize: 11,
                    fontWeight: 700,
                    textAlign: "center",
                  }}
                >
                  {tail}
                </span>
              ))}
            </div>
          </Section>

          <Section eyebrow="Proximity">
            <p
              style={{
                fontSize: 13,
                color: SS_TOKENS.fg1,
                margin: 0,
                lineHeight: 1.45,
              }}
            >
              While the app is open and GPS is granted, ping me when a tracked
              bird gets within range.
            </p>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginTop: 10,
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={proximityOn}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setProximityOn(next);
                    setProximityEnabled(next);
                  }}
                />
                <span
                  className="ss-mono"
                  style={{ fontSize: 12, letterSpacing: 0 }}
                >
                  ENABLED
                </span>
              </label>
              <span style={{ flex: 1 }} />
              <input
                type="number"
                min={1}
                max={50}
                value={proximityNm}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n) && n > 0) {
                    setProximityNm(n);
                    setProximityThresholdNm(n);
                  }
                }}
                disabled={!proximityOn}
                aria-label="Proximity threshold in nautical miles"
                style={{
                  width: 56,
                  padding: "6px 8px",
                  background: SS_TOKENS.bg2,
                  border: `.5px solid ${SS_TOKENS.hairline2}`,
                  borderRadius: 6,
                  color: SS_TOKENS.fg0,
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  textAlign: "right",
                  opacity: proximityOn ? 1 : 0.5,
                }}
              />
              <span
                className="ss-mono"
                style={{ fontSize: 11, color: SS_TOKENS.fg2 }}
              >
                NM
              </span>
            </div>
          </Section>

          <Section eyebrow="Quiet hours">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <HourInput
                value={prefs.quiet_start_h}
                onChange={(h) => persistPrefs({ quiet_start_h: h })}
              />
              <span
                className="ss-mono"
                style={{ color: SS_TOKENS.fg2, fontSize: 12 }}
              >
                to
              </span>
              <HourInput
                value={prefs.quiet_end_h}
                onChange={(h) => persistPrefs({ quiet_end_h: h })}
              />
              <span
                className="ss-mono"
                style={{ color: SS_TOKENS.fg2, fontSize: 11 }}
              >
                {prefs.tz}
              </span>
            </div>
            <p
              style={{
                marginTop: 10,
                fontSize: 12,
                color: SS_TOKENS.fg2,
                lineHeight: 1.45,
              }}
            >
              Channel 19 stays quiet between these hours.
            </p>
          </Section>

          <Section eyebrow="Test">
            <button
              type="button"
              onClick={onTest}
              disabled={permission !== "granted"}
              style={{
                padding: "8px 14px",
                borderRadius: 999,
                border: `.5px solid ${SS_TOKENS.hairline2}`,
                background: SS_TOKENS.bg2,
                color: SS_TOKENS.fg0,
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                letterSpacing: 0,
                cursor: permission === "granted" ? "pointer" : "default",
                opacity: permission === "granted" ? 1 : 0.5,
                touchAction: "manipulation",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              Send me a test ping
            </button>
          </Section>
        </>
      )}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            left: "50%",
            transform: "translateX(-50%)",
            bottom: 84,
            padding: "10px 14px",
            borderRadius: 999,
            background: SS_TOKENS.surface,
            color: SS_TOKENS.fg0,
            border: `.5px solid ${SS_TOKENS.hairline2}`,
            boxShadow: SS_TOKENS.shadowMd,
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            fontFamily: "inherit",
            fontSize: 12,
            letterSpacing: 0,
            zIndex: 30,
            maxWidth: "calc(100% - 32px)",
            textAlign: "center",
          }}
        >
          {toast}
        </div>
      )}
    </main>
  );
}

function Section({
  eyebrow,
  children,
}: {
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <div
        className="ss-mono"
        style={{
          fontSize: 9.5,
          color: SS_TOKENS.fg2,
          letterSpacing: 0,
          textTransform: "uppercase",
          marginBottom: 12,
        }}
      >
        {eyebrow}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {children}
      </div>
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
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

function HourInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (h: number) => void;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      max={23}
      value={value}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (!Number.isFinite(n)) return;
        const clamped = Math.max(0, Math.min(23, Math.trunc(n)));
        onChange(clamped);
      }}
      className="ss-mono"
      style={{
        width: 56,
        padding: "6px 8px",
        borderRadius: 8,
        background: SS_TOKENS.bg2,
        border: `.5px solid ${SS_TOKENS.hairline2}`,
        color: SS_TOKENS.fg0,
        fontSize: 14,
        textAlign: "center",
      }}
    />
  );
}

function UnsupportedCard() {
  return (
    <Card>
      <p
        style={{
          fontSize: 13.5,
          color: SS_TOKENS.fg1,
          margin: 0,
          lineHeight: 1.5,
        }}
      >
        This browser doesn't support push notifications. Try Chrome, Firefox,
        or Safari on iOS 16.4+ after Add to Home Screen.
      </p>
    </Card>
  );
}

function IosNotPwaCard({
  reason,
}: {
  reason?: "ios-not-pwa" | "ios-too-old";
}) {
  return (
    <Card>
      <div
        className="ss-mono"
        style={{
          fontSize: 9.5,
          color: SS_TOKENS.fg2,
          letterSpacing: 0,
          marginBottom: 8,
        }}
      >
        ON IPHONE
      </div>
      <p
        style={{
          fontSize: 14,
          color: SS_TOKENS.fg0,
          margin: 0,
          lineHeight: 1.5,
        }}
      >
        {reason === "ios-too-old"
          ? "iOS 16.4 or later is required for browser-based push. Update iOS to enable alerts."
          : "Alerts only work after you Add to Home Screen. Tap Share, then Add to Home Screen, then open the app icon."}
      </p>
    </Card>
  );
}
