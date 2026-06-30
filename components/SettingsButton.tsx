import Link from "next/link";
import { SS_TOKENS } from "@/lib/tokens";
import type { CSSProperties } from "react";

type Props = {
  href?: string;
  label?: string;
  style?: CSSProperties;
};

export function SettingsButton({
  href = "/settings",
  label = "Settings",
  style,
}: Props) {
  return (
    <Link
      href={href}
      prefetch={false}
      style={{
        boxSizing: "border-box",
        width: "min(100%, 360px)",
        minHeight: "clamp(50px, 13vw, 56px)",
        padding: "0 22px",
        alignSelf: "center",
        marginTop: -6,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        color: SS_TOKENS.alert,
        background: "#050505",
        border: "1px solid rgba(246, 196, 49, 0.44)",
        borderRadius: 16,
        textDecoration: "none",
        fontSize: 16,
        fontWeight: 800,
        letterSpacing: 0,
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        boxShadow: "0 12px 28px rgba(0, 0, 0, 0.32)",
        ...style,
      }}
    >
      <GearIcon />
      <span>{label}</span>
    </Link>
  );
}

function GearIcon() {
  return (
    <svg
      aria-hidden
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1A2 2 0 1 1 4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9L4.2 7A2 2 0 1 1 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 1 1 19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  );
}
