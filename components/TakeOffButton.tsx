"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SS_TOKENS } from "@/lib/tokens";
import { useRideLaunchPreflight } from "@/lib/hooks/useRideLaunchPreflight";

type Props = {
  variant?: "hero" | "compact";
};

export function TakeOffButton({ variant = "hero" }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const runRideLaunchPreflight = useRideLaunchPreflight();
  const [busy, setBusy] = useState(false);
  const compact = variant === "compact";
  const iconSize = compact ? 18 : 23;

  const onTakeOff = async () => {
    setBusy(true);
    await runRideLaunchPreflight();
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
        boxSizing: "border-box",
        width: compact ? "auto" : "min(100%, 360px)",
        minHeight: compact ? 48 : "clamp(60px, 16vw, 70px)",
        padding: compact ? "0 18px" : "0 clamp(22px, 6vw, 28px)",
        borderRadius: compact ? 999 : 16,
        border: compact
          ? "1px solid rgba(246, 196, 49, 0.34)"
          : "1px solid #ffe28a",
        background: busy ? "#1b1608" : "#f6c431",
        color: busy ? "#f6c431" : "#050505",
        boxShadow: compact
          ? SS_TOKENS.shadowSm
          : `0 0 34px rgba(246, 196, 49, 0.24), 0 18px 36px rgba(0, 0, 0, 0.42)`,
        cursor: busy ? "wait" : "pointer",
        opacity: busy ? 0.72 : 1,
        fontFamily: compact ? "inherit" : "var(--font-brand)",
        fontSize: compact ? 14 : "clamp(24px, 6.7vw, 26px)",
        fontWeight: 800,
        letterSpacing: 0,
        display: "inline-flex",
        alignItems: "center",
        alignSelf: compact ? undefined : "center",
        justifyContent: "center",
        gap: compact ? 8 : "clamp(14px, 4.5vw, 18px)",
        touchAction: "manipulation",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <svg
        aria-hidden
        width={iconSize}
        height={iconSize}
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
