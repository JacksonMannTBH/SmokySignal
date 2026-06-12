"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SS_TOKENS } from "@/lib/tokens";
import type { ReactNode } from "react";

const TABS: { id: string; label: string; href: string; icon: ReactNode }[] = [
  { id: "home", label: "Home", href: "/", icon: <HomeIcon /> },
  { id: "radar", label: "Radar", href: "/radar", icon: <RadarIcon /> },
  { id: "dash", label: "Dash", href: "/dash", icon: <DashIcon /> },
  { id: "activity", label: "Activity", href: "/activity", icon: <ActivityIcon /> },
  { id: "about", label: "About", href: "/about", icon: <InfoIcon /> },
];

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      style={{
        position: "fixed",
        left: "max(12px, env(safe-area-inset-left))",
        right: "max(12px, env(safe-area-inset-right))",
        bottom: "max(12px, env(safe-area-inset-bottom))",
        display: "flex",
        justifyContent: "space-around",
        maxWidth: 560,
        margin: "0 auto",
        padding: "7px",
        background: SS_TOKENS.surfaceTranslucent,
        backdropFilter: "blur(24px) saturate(1.15)",
        WebkitBackdropFilter: "blur(24px) saturate(1.15)",
        border: `.5px solid ${SS_TOKENS.hairline2}`,
        borderRadius: 28,
        boxShadow: SS_TOKENS.shadowLg,
        zIndex: 50,
      }}
    >
      {TABS.map((t) => {
        const active = isActive(pathname, t.href);
        return (
          <Link
            key={t.id}
            href={t.href}
            prefetch
            aria-current={active ? "page" : undefined}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              padding: "7px 10px",
              minWidth: 56,
              minHeight: 44,
              color: active ? SS_TOKENS.fg0 : SS_TOKENS.fg2,
              background: active ? "rgba(244,196,48,0.18)" : "transparent",
              borderRadius: 22,
              textDecoration: "none",
              touchAction: "manipulation",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1, display: "flex" }}>
              {t.icon}
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0,
              }}
            >
              {t.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

// Lucide-style "home" icon — house outline.
function HomeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M9 22V12h6v10" />
    </svg>
  );
}

// Lucide-style "activity" icon — stack of horizontal lines (changelog feel).
function ActivityIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 6H8" />
      <path d="M21 12H8" />
      <path d="M21 18H8" />
      <circle cx="4" cy="6" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="4" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="4" cy="18" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Lucide-style "info" icon — circle with i.
function InfoIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

// Lucide-style "gauge" icon — at-a-glance dashboard summary.
function DashIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12 14 4-4" />
      <path d="M3.34 19a10 10 0 1 1 17.32 0" />
    </svg>
  );
}

// Lucide-style "radar" icon — concentric arcs + sweep.
function RadarIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19.07 4.93A10 10 0 0 0 6.99 3.34" />
      <path d="M4 6h.01" />
      <path d="M2.29 9.62A10 10 0 1 0 21.31 8.35" />
      <path d="M16.24 7.76A6 6 0 1 0 17.91 12" />
      <path d="M12 18h.01" />
      <path d="M17.99 11.66A6 6 0 0 1 15.77 16.67" />
      <circle cx="12" cy="12" r="2" />
      <path d="m13.41 10.59 5.66-5.66" />
    </svg>
  );
}
