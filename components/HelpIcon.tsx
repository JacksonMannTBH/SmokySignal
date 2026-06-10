"use client";

import Link from "next/link";
import { SS_TOKENS } from "@/lib/tokens";
import { Tooltip } from "./Tooltip";

/**
 * Small "?" pill that links to /help. Discovery surface so the docs
 * are findable from every meaningful screen without crowding the
 * already-busy headers.
 */
export function HelpIcon({
  variant = "fixed",
  ariaLabel = "Help and documentation",
}: {
  /** "fixed" floats next to the wake-lock button; "inline" sits in flow. */
  variant?: "fixed" | "inline";
  ariaLabel?: string;
}) {
  const fixedStyle: React.CSSProperties = {
    position: "fixed",
    top: 6,
    right: 50,
    zIndex: 30,
    width: 44,
    height: 44,
    padding: 6,
  };
  const inlineStyle: React.CSSProperties = {
    width: 44,
    height: 44,
    padding: 6,
  };

  return (
    <Tooltip side="bottom" align="end" content="Help & docs">
      <Link
        href="/help"
        aria-label={ariaLabel}
        style={{
          ...(variant === "fixed" ? fixedStyle : inlineStyle),
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          textDecoration: "none",
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <span
          aria-hidden
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.84)",
            border: `.5px solid ${SS_TOKENS.hairline}`,
            boxShadow: SS_TOKENS.shadowSm,
            color: SS_TOKENS.fg1,
            fontSize: 14,
            fontWeight: 700,
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
          }}
        >
          ?
        </span>
      </Link>
    </Tooltip>
  );
}
