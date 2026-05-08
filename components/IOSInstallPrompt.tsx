"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SS_TOKENS } from "@/lib/tokens";
import { isPushSupported } from "@/lib/push/client";

const STORAGE_KEY = "ss_install_dismissed";
const POST_INSTALL_DISMISS_KEY = "ss_post_install_dismissed";
const FIRST_STANDALONE_KEY = "ss_first_standalone_visit";
const PULSE_KEYFRAME_ID = "ss-arm-alerts-pulse";
const DISMISS_DAYS = 30;
const TABBAR_HEIGHT = 66;
// Routes whose layout includes the bottom tab bar — banner sits above it.
const TABBAR_PATHS = new Set(["/", "/radar", "/dash"]);

type Standalone = Navigator & { standalone?: boolean };
type Mode = "hidden" | "pre-install" | "post-install";

function isIOSSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPad on iPadOS 13+ reports as Mac; check maxTouchPoints to disambiguate.
  const iPadOS =
    ua.includes("Macintosh") &&
    typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/.test(ua) || iPadOS;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  return Boolean((navigator as Standalone).standalone);
}

function isDismissed(key: string): boolean {
  if (typeof window === "undefined") return false;
  const raw = window.localStorage.getItem(key);
  if (!raw) return false;
  const ts = Number(raw);
  if (!Number.isFinite(ts)) return false;
  const ageMs = Date.now() - ts;
  return ageMs < DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

function ensurePulseKeyframes() {
  if (typeof document === "undefined") return;
  if (document.getElementById(PULSE_KEYFRAME_ID)) return;
  const style = document.createElement("style");
  style.id = PULSE_KEYFRAME_ID;
  style.textContent = `@keyframes ss-arm-alerts-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(255,159,28,.55); }
    50% { box-shadow: 0 0 0 6px rgba(255,159,28,0); }
  }`;
  document.head.appendChild(style);
}

export function IOSInstallPrompt() {
  const pathname = usePathname();
  const [mode, setMode] = useState<Mode>("hidden");
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (!isIOSSafari()) return;
    const standalone = isStandalone();
    if (!standalone) {
      if (!isDismissed(STORAGE_KEY)) setMode("pre-install");
      return;
    }
    // Standalone PWA — only show the step-3 prompt if we know push is
    // supported and the rider hasn't armed yet, and they haven't already
    // dismissed this branch.
    if (!isPushSupported()) return;
    if (isDismissed(POST_INSTALL_DISMISS_KEY)) return;
    let cancelled = false;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (cancelled || sub) return;
        // One-time pulse on the first standalone visit so the rider
        // notices the deep-link, then never again.
        const firstSeen = window.localStorage.getItem(FIRST_STANDALONE_KEY);
        if (!firstSeen) {
          window.localStorage.setItem(
            FIRST_STANDALONE_KEY,
            String(Date.now()),
          );
          setPulse(true);
        }
        setMode("post-install");
      })
      .catch(() => {
        if (!cancelled) setMode("post-install");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (pulse) ensurePulseKeyframes();
  }, [pulse]);

  if (mode === "hidden") return null;

  const onTabs = pathname != null && TABBAR_PATHS.has(pathname);
  const bottomOffset = onTabs ? TABBAR_HEIGHT : 0;
  const dismissKey =
    mode === "pre-install" ? STORAGE_KEY : POST_INSTALL_DISMISS_KEY;
  const dismiss = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(dismissKey, String(Date.now()));
    }
    setMode("hidden");
  };

  return (
    <div
      role="dialog"
      // pointer-events: none on the wrapper so the prompt doesn't intercept
      // taps meant for the map / filter button on /radar. Interactive children
      // opt back in via pointerEvents: "auto". Instruction text stays
      // visible (the wrapper is still painted) but isn't tappable — taps on
      // text fall through to the radar layer underneath. The X button + the
      // post-install "Arm alerts" link are the only tap targets inside the
      // prompt. Fixes verify-prod #10 (hot-zones filter click intercept).
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: bottomOffset,
        zIndex: 40,
        pointerEvents: "none",
        // Tighter vertical padding (was 12px → 8px) so the prompt
        // takes less map / hero real estate on /radar and /. Also
        // tighter horizontal padding on the X-button side because
        // the button itself now carries 44 px hit area.
        padding: "8px 4px 8px 14px",
        paddingBottom: "calc(8px + env(safe-area-inset-bottom))",
        background: SS_TOKENS.bg1,
        borderTop: `.5px solid ${SS_TOKENS.hairline}`,
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <div style={{ flex: 1, fontSize: 12.5, lineHeight: 1.45, color: SS_TOKENS.fg0 }}>
        {mode === "pre-install" ? (
          <PreInstallCopy />
        ) : (
          <PostInstallCopy pulse={pulse} />
        )}
      </div>
      {/* 44×44 hit area (a11y minimum) wraps a 28×28 visual circle so
          the rider hits the dismiss target even with gloves on. */}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss install prompt"
        style={{
          width: 44,
          height: 44,
          background: "transparent",
          border: 0,
          color: SS_TOKENS.fg2,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          padding: 0,
          pointerEvents: "auto",
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <span
          aria-hidden
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            border: `.5px solid ${SS_TOKENS.hairline2}`,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <XIcon />
        </span>
      </button>
    </div>
  );
}

function PreInstallCopy() {
  // Compressed two-line variant of the prior 5-line block — the prompt
  // sat over ~40 % of /radar's vertical space and dominated /'s hero
  // on first visit. Same 3-step intent (share → Add to Home Screen →
  // Arm alerts), one tighter line.
  return (
    <>
      <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 2 }}>
        iOS push: 2 steps
      </div>
      <div style={{ fontSize: 11.5, color: SS_TOKENS.fg1, lineHeight: 1.45 }}>
        Tap <ShareIcon /> →{" "}
        <span style={{ color: SS_TOKENS.alert }}>Add to Home Screen</span>,
        then open from your home screen and arm alerts.
      </div>
    </>
  );
}

function PostInstallCopy({ pulse }: { pulse: boolean }) {
  return (
    <>
      <div className="ss-eyebrow" style={{ marginBottom: 4 }}>
        STEP 3 · ARM ALERTS
      </div>
      <div style={{ fontSize: 12.5, color: SS_TOKENS.fg1, marginBottom: 8 }}>
        You&rsquo;re in the app. One more tap for push notifications.
      </div>
      <Link
        href="/settings/alerts"
        style={{
          display: "inline-block",
          background: SS_TOKENS.alert,
          color: SS_TOKENS.bg0,
          padding: "6px 12px",
          borderRadius: 8,
          fontSize: 12.5,
          fontWeight: 600,
          textDecoration: "none",
          animation: pulse ? "ss-arm-alerts-pulse 1.6s ease-out 3" : undefined,
          pointerEvents: "auto",
        }}
      >
        Arm alerts
      </Link>
    </>
  );
}

function ShareIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ verticalAlign: "-2px", margin: "0 2px" }}
      aria-hidden
    >
      <path d="M12 3 v12" />
      <path d="m7 8 5-5 5 5" />
      <path d="M5 21h14a2 2 0 0 0 2-2v-6" />
      <path d="M3 13v6a2 2 0 0 0 2 2" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
