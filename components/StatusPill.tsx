"use client";

import { SS_TOKENS } from "@/lib/tokens";
import { Tooltip } from "./Tooltip";

type Props = {
  kind?: "alert" | "clear";
  label: string;
  sub?: string;
  big?: boolean;
  tooltip?: React.ReactNode;
};

export function StatusPill({
  kind = "clear",
  label,
  sub,
  big,
  tooltip,
}: Props) {
  const isAlert = kind === "alert";
  const c = isAlert ? SS_TOKENS.alert : SS_TOKENS.clear;
  const bg = isAlert ? "rgba(255,247,235,0.88)" : "rgba(240,250,246,0.9)";
  const pill = (
    <span
      role="status"
      aria-live="polite"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: big ? "8px 13px" : "5px 10px",
        borderRadius: 999,
        background: bg,
        border: `.5px solid ${isAlert ? "rgba(244,196,48,0.42)" : "rgba(5,5,5,0.22)"}`,
        boxShadow: big ? SS_TOKENS.shadowSm : "none",
        fontSize: big ? 12 : 11,
        fontWeight: 700,
        color: c,
        letterSpacing: 0,
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: c,
          animation: isAlert ? "ss-blink 1.4s ease-in-out infinite" : "none",
          boxShadow: `0 0 0 4px ${isAlert ? SS_TOKENS.alertDim : SS_TOKENS.clearDim}`,
        }}
      />
      <span>{label}</span>
      {sub && (
        <span style={{ color: c, opacity: 0.65, fontWeight: 400 }}>· {sub}</span>
      )}
    </span>
  );
  if (!tooltip) return pill;
  return <Tooltip content={tooltip}>{pill}</Tooltip>;
}
