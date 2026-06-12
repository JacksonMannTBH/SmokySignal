"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SS_TOKENS } from "@/lib/tokens";
import { useDeviceHeading } from "@/lib/hooks/useDeviceHeading";

type Props = {
  variant?: "hero" | "compact";
};

function requestLocationOnce(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => resolve(true),
      () => resolve(false),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 8000 },
    );
  });
}

async function requestNotificationOnce(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (typeof Notification === "undefined") return false;
  if (!("serviceWorker" in navigator)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  } catch {
    return false;
  }
}

export function TakeOffButton({ variant = "hero" }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const heading = useDeviceHeading();
  const [busy, setBusy] = useState(false);
  const compact = variant === "compact";

  const onTakeOff = async () => {
    setBusy(true);
    const locationPromise = requestLocationOnce();
    const headingPromise = heading.requestPermission();
    const notificationPromise = requestNotificationOnce();
    await Promise.allSettled([
      locationPromise,
      headingPromise,
      notificationPromise,
    ]);
    const mock = searchParams.get("mock");
    router.push(mock ? `/ride?mock=${encodeURIComponent(mock)}` : "/ride");
  };

  return (
    <button
      type="button"
      onClick={onTakeOff}
      disabled={busy}
      aria-label="Take Off and enter Riding Mode"
      style={{
        width: compact ? "auto" : "100%",
        minHeight: compact ? 44 : 58,
        padding: compact ? "0 16px" : "0 22px",
        borderRadius: compact ? 999 : 18,
        border: `.5px solid color-mix(in srgb, ${SS_TOKENS.alert} 52%, transparent)`,
        background: busy
          ? SS_TOKENS.bg2
          : `linear-gradient(135deg, ${SS_TOKENS.alert}, #ffe58a)`,
        color: "#050505",
        boxShadow: compact ? SS_TOKENS.shadowSm : SS_TOKENS.shadowMd,
        cursor: busy ? "wait" : "pointer",
        opacity: busy ? 0.72 : 1,
        fontFamily: "inherit",
        fontSize: compact ? 13 : 18,
        fontWeight: 800,
        letterSpacing: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        touchAction: "manipulation",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <svg
        aria-hidden
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 19V5" />
        <path d="m5 12 7-7 7 7" />
      </svg>
      <span>{busy ? "Taking Off..." : "Take Off"}</span>
    </button>
  );
}
